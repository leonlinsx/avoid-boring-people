import { canonicalSiteOrigin, isSameSiteRequest } from '../site-origin.ts';
import { verifyTurnstile } from '../turnstile.ts';
import { isHoneypotFilled, readJsonBody } from '../request-body.ts';
import { contactAlert } from './alerting.ts';
import {
  CONTACT_SUCCESS_MESSAGE,
  UNKNOWN_SOURCE_PAGE,
  contactErrors,
  normalizeSourcePage,
  validateContactNote,
  type ContactErrorCode,
} from './domain.ts';
import type { NeonDb } from '../neon.ts';
import { handOffToLinCheck } from './lin-check.ts';
import { sendContactNotification, type ContactNotification } from './notify.ts';
import {
  createContactSubmission,
  markContactLinCheckSynced,
  markContactNotified,
} from './store.ts';

// Three fields and a Turnstile token are nowhere near this large, so a request of
// this size is never real content and is refused before it is parsed.
export const MAX_CONTACT_REQUEST_BYTES = 16 * 1024;

export type ContactHandlerDeps = {
  // null when no database is configured in this environment.
  db: NeonDb | null;
  fetchImpl?: typeof fetch;
  turnstileSecret?: string;
  env?: NodeJS.ProcessEnv;
  /** Injected so the handler can be exercised without sending real mail. */
  notify?: (note: ContactNotification) => Promise<void>;
};

function jsonHeaders(): Record<string, string> {
  return {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
  };
}

function errorResponse(code: ContactErrorCode): Response {
  const { message, field, status } = contactErrors[code];
  return new Response(
    JSON.stringify({ ok: false, error: code, message, field }),
    { status, headers: jsonHeaders() },
  );
}

function okResponse(): Response {
  return new Response(
    JSON.stringify({ ok: true, message: CONTACT_SUCCESS_MESSAGE }),
    { status: 200, headers: jsonHeaders() },
  );
}

type RefusalReason =
  | 'cross_site'
  | 'db_unconfigured'
  | 'turnstile_unconfigured'
  | 'turnstile_unavailable'
  | 'turnstile_invalid';

// A refusal with no log is indistinguishable from one reader's mistake, so every
// refusal is recorded. The reason is the only field: no name, address, or
// message body can reach a log line.
function logRefusal(reason: RefusalReason): void {
  console.error('contact_refused', { reason });
}

function unavailable(reason: RefusalReason): Response {
  logRefusal(reason);
  return errorResponse('unavailable');
}

// The page the note was written from is taken from the browser's own `Referer`
// and only kept when it points at this site's canonical origin, so a note cannot
// claim to have come from somewhere it did not. The query string is dropped and
// a page that cannot be read or trusted is recorded as unknown rather than
// guessed at.
function sourcePageFromRequest(request: Request): string {
  const referer = request.headers.get('referer');
  if (!referer) return UNKNOWN_SOURCE_PAGE;
  let url: URL;
  try {
    url = new URL(referer);
  } catch {
    return UNKNOWN_SOURCE_PAGE;
  }
  if (url.origin !== canonicalSiteOrigin()) return UNKNOWN_SOURCE_PAGE;
  return normalizeSourcePage(url.pathname);
}

export async function handleContactNote(
  request: Request,
  deps: ContactHandlerDeps,
): Promise<Response> {
  if (!isSameSiteRequest(request)) {
    // An origin mismatch is what a mistyped origin or a preview deployment looks
    // like, so a reader-visible 403 is recorded rather than leaving the operator
    // guessing why the form "does nothing" for some people.
    logRefusal('cross_site');
    return errorResponse('cross_site');
  }
  if (!deps.db) return unavailable('db_unconfigured');

  const parsed = await readJsonBody(request, MAX_CONTACT_REQUEST_BYTES);
  if (!parsed.ok) return errorResponse(parsed.error);

  // Verification happens before anything is written, and a Turnstile outage
  // fails closed: no unverified note is ever accepted. It also covers a double
  // submit of one rendered page, because a token is redeemed once: the second
  // request carrying that token is refused here instead of storing the note
  // twice. A reader who sends again after a failure gets a fresh token, and so a
  // fresh note — the browser tells them not to resend a note it could not
  // confirm, and there is no idempotency key that could catch the ones that do.
  const verification = await verifyTurnstile(parsed.value.turnstileToken, {
    secret: deps.turnstileSecret,
    fetchImpl: deps.fetchImpl,
  });
  if (verification === 'unconfigured')
    return unavailable('turnstile_unconfigured');
  if (verification === 'unavailable')
    return unavailable('turnstile_unavailable');
  if (verification === 'invalid') {
    logRefusal('turnstile_invalid');
    return errorResponse('verification_failed');
  }

  // Honeypot: a filled field is a bot, which gets the same response as a
  // successful note and no indication that anything was rejected. Nothing is
  // stored and no mail is sent, so the trap leaves no trace to game.
  if (isHoneypotFilled(parsed.value.note_origin)) return okResponse();

  const validated = validateContactNote({
    name: parsed.value.name,
    email: parsed.value.email,
    message: parsed.value.message,
  });
  if (!validated.ok) return errorResponse(validated.error);

  const sourcePage = sourcePageFromRequest(request);

  let stored: { id: string; createdAt: string };
  try {
    stored = await createContactSubmission(deps.db, {
      ...validated.value,
      sourcePage,
    });
  } catch (error) {
    contactAlert('submission_store_failure', {
      errorName: error instanceof Error ? error.name : 'unknown',
    });
    return errorResponse('unavailable');
  }

  const note: ContactNotification = {
    id: stored.id,
    ...validated.value,
    sourcePage,
    receivedAt: stored.createdAt,
  };

  // The notification is the whole point of the feature: if it did not go out,
  // the reader is told to email directly rather than being left believing the
  // note arrived. The stored row stays unfinished, so the note is still
  // recoverable by hand.
  try {
    await (deps.notify ?? sendContactNotification)(note);
  } catch (error) {
    contactAlert('notification_failure', {
      errorName: error instanceof Error ? error.name : 'unknown',
    });
    return errorResponse('delivery_failed');
  }

  // Delivered is recorded before the optional handoff runs, so the one fact that
  // decides whether a note needs attention is durable as soon as it is true. A
  // handoff that hangs or an abandoned response can then cost a retry at worst,
  // never a delivered note that still looks unanswered.
  try {
    await markContactNotified(deps.db, stored.id);
  } catch (error) {
    // The note itself was delivered; only its bookkeeping failed, so the reader
    // is not asked to try again.
    contactAlert('delivery_record_failure', {
      errorName: error instanceof Error ? error.name : 'unknown',
    });
  }

  // Lin Check is optional and never blocks a note that already reached the inbox:
  // a failed handoff is reported and left for the operator to repeat, and the
  // submission id travels as the idempotency key so repeating it cannot create a
  // second inbound item.
  const linCheck = await handOffToLinCheck(note, {
    fetchImpl: deps.fetchImpl,
    env: deps.env,
  });
  if (linCheck === 'failed') contactAlert('lin_check_failure');
  if (linCheck === 'sent') {
    try {
      await markContactLinCheckSynced(deps.db, stored.id);
    } catch (error) {
      contactAlert('delivery_record_failure', {
        errorName: error instanceof Error ? error.name : 'unknown',
      });
    }
  }

  return okResponse();
}
