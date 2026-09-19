// Optional handoff to Lin Check, the separate internal system where a person
// reviews an unknown sender before anything becomes a relationship record.
//
// This module owns the outbound HTTP call and nothing else. It never reads or
// writes Lin Check's database, never assumes Lin Check's schema, and never
// creates a Person, an Organization, or a relationship. The site reports an
// inbound note; deciding whether that inbound is interesting, and whether it
// should be attached to an existing Person or become a new one, stays inside Lin
// Check and stays a human decision.
//
// The whole handoff is optional. When it is not configured, the note is still
// stored and still emailed, which is why `unconfigured` is not a failure.

// Chosen to fit inside the request that a reader is waiting on rather than to be
// generous to Lin Check: the handoff runs after the notification was recorded, so
// a slow handoff only costs a retry, while a reader left waiting costs a note
// that arrives twice (once here, once by email). The submission id is sent as the
// idempotency key, so repeating a timed-out handoff cannot duplicate it.
export const LIN_CHECK_TIMEOUT_MS = 3_000;

export type LinCheckHandoff = {
  id: string;
  name: string;
  email: string;
  message: string;
  sourcePage: string;
  receivedAt: string;
};

export type LinCheckResult = 'sent' | 'unconfigured' | 'failed';

export type LinCheckConfig = {
  endpoint: string;
  token: string;
};

export function linCheckConfig(
  env: NodeJS.ProcessEnv = process.env,
): LinCheckConfig | null {
  const endpoint = env.LIN_CHECK_INBOUND_URL?.trim();
  const token = env.LIN_CHECK_INBOUND_TOKEN?.trim();
  if (!endpoint || !token) return null;
  // The handoff carries a bearer token and the words of a stranger, so it only
  // ever leaves over https. A misconfigured `http://` endpoint would otherwise
  // put the token on the wire in clear text.
  try {
    if (new URL(endpoint).protocol !== 'https:') return null;
  } catch {
    return null;
  }
  return { endpoint, token };
}

let warnedAboutMissingHandoff = false;

// Nothing fails when the handoff is unconfigured, so nothing else would report
// it. The line names the state once per process, on the first note that could
// have been handed off, so an operator reading logs can tell "Lin Check is not
// wired up yet" from "Lin Check is refusing notes".
export function warnIfLinCheckUnconfigured(): void {
  if (warnedAboutMissingHandoff) return;
  warnedAboutMissingHandoff = true;
  console.warn(
    '[contact] LIN_CHECK_INBOUND_URL (an https endpoint) or LIN_CHECK_INBOUND_TOKEN is not set: notes are stored and emailed but are not handed off to Lin Check for review.',
  );
}

// The exact body the contract promises. `kind` names the source system so Lin
// Check can keep website notes distinguishable from anything else it ingests.
export function linCheckPayload(
  note: LinCheckHandoff,
): Record<string, unknown> {
  return {
    kind: 'website_note',
    id: note.id,
    name: note.name,
    email: note.email,
    message: note.message,
    sourcePage: note.sourcePage,
    receivedAt: note.receivedAt,
  };
}

// `Idempotency-Key` is the stored submission id, so a repeated handoff of the
// same note cannot create a second inbound item.
export async function handOffToLinCheck(
  note: LinCheckHandoff,
  options: {
    fetchImpl?: typeof fetch;
    env?: NodeJS.ProcessEnv;
    timeoutMs?: number;
  } = {},
): Promise<LinCheckResult> {
  const config = linCheckConfig(options.env ?? process.env);
  if (!config) {
    warnIfLinCheckUnconfigured();
    return 'unconfigured';
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(config.endpoint, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${config.token}`,
        'content-type': 'application/json',
        'idempotency-key': note.id,
      },
      body: JSON.stringify(linCheckPayload(note)),
      signal: AbortSignal.timeout(options.timeoutMs ?? LIN_CHECK_TIMEOUT_MS),
    });
    return response.ok ? 'sent' : 'failed';
  } catch {
    return 'failed';
  }
}
