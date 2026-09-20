// Contact-note coverage: validation, notifications, the Lin Check handoff, handlers, and SQL.

import assert from 'node:assert/strict';
import { requiresOriginRejection } from '../../src/lib/newsletter/request-origin.ts';

import {
  CONTACT_EMAIL,
  CONTACT_SUCCESS_MESSAGE,
  MAX_CONTACT_EMAIL_LENGTH,
  MAX_CONTACT_MESSAGE_LENGTH,
  MAX_CONTACT_NAME_LENGTH,
  MAX_CONTACT_SOURCE_LENGTH,
  UNKNOWN_SOURCE_PAGE,
  contactErrors,
  normalizeContactEmail,
  normalizeContactMessage,
  normalizeContactName,
  normalizeSourcePage,
  validateContactNote,
} from '../../src/lib/contact/domain.ts';
import { contactAlertKinds } from '../../src/lib/contact/alerting.ts';
import {
  createContactSubmission,
  markContactLinCheckSynced,
  markContactNotified,
} from '../../src/lib/contact/store.ts';
import {
  NOTIFICATION_TIMEOUT_MS,
  buildContactNotification,
  contactNotificationSubject,
  sendContactNotification,
  type ContactNotification,
} from '../../src/lib/contact/notify.ts';
import {
  LIN_CHECK_TIMEOUT_MS,
  handOffToLinCheck,
  linCheckConfig,
  linCheckPayload,
  warnIfLinCheckUnconfigured,
} from '../../src/lib/contact/lin-check.ts';
import {
  MAX_CONTACT_REQUEST_BYTES,
  handleContactNote,
  type ContactHandlerDeps,
} from '../../src/lib/contact/handlers.ts';
import { NEWSLETTER_FROM } from '../../src/lib/newsletter/email.ts';
import fs from 'node:fs';
import path from 'node:path';
import {
  REPO_ROOT,
  withCapturedLogs,
  makeFakeDb,
  makeForbiddenDb,
  soleQuery,
  verifiedTurnstileFetch,
} from '../helpers/harness.ts';

export function testContactDomain() {
  // A name lands in an email subject, so it collapses to one line with no
  // control characters.
  assert.equal(normalizeContactName('  Leon \n\n Lin  '), 'Leon Lin');
  assert.equal(normalizeContactName('Leon\u0000Lin'), 'LeonLin');
  // C1 controls go with C0. U+0085 NEL matters most: some mail software reads it
  // as a line break while JavaScript's `\s` does not, so leaving it in would let
  // a header-shaped name through the collapse.
  assert.equal(normalizeContactName('Leon\u0085Lin'), 'LeonLin');
  assert.equal(normalizeContactName('Leon\u009bLin'), 'LeonLin');
  assert.equal(normalizeContactName('   '), '');
  assert.equal(normalizeContactName(42), '');

  // The reply address is kept exactly as typed apart from surrounding space: it
  // identifies one person to reply to, not a stored identity key.
  assert.equal(
    normalizeContactEmail('  Leon@Example.COM '),
    'Leon@Example.COM',
  );
  assert.equal(normalizeContactEmail(undefined), '');
  // A C1 control cannot reach SES as a reply address, which would reject it.
  assert.equal(
    normalizeContactEmail('leon\u0085@example.com'),
    'leon@example.com',
  );

  // A message keeps its paragraphs, on one line-ending convention.
  assert.equal(
    normalizeContactMessage('  one\r\ntwo\r\n\r\nthree  '),
    'one\ntwo\n\nthree',
  );
  assert.equal(normalizeContactMessage(null), '');

  // Every field is required and length-limited, and the order of the checks
  // decides which single error the reader sees.
  assert.deepEqual(
    validateContactNote({
      name: '   ',
      email: 'leon@example.com',
      message: 'hi',
    }),
    { ok: false, error: 'name_required' },
  );
  assert.deepEqual(
    validateContactNote({
      name: 'a'.repeat(MAX_CONTACT_NAME_LENGTH + 1),
      email: 'leon@example.com',
      message: 'hi',
    }),
    { ok: false, error: 'name_too_long' },
  );
  assert.deepEqual(
    validateContactNote({ name: 'Leon', email: '', message: 'hi' }),
    { ok: false, error: 'email_required' },
  );
  assert.deepEqual(
    validateContactNote({
      name: 'Leon',
      email: 'not-an-address',
      message: 'hi',
    }),
    { ok: false, error: 'email_invalid' },
  );
  assert.deepEqual(
    validateContactNote({
      name: 'Leon',
      email: `${'a'.repeat(MAX_CONTACT_EMAIL_LENGTH)}@example.com`,
      message: 'hi',
    }),
    { ok: false, error: 'email_too_long' },
  );
  assert.deepEqual(
    validateContactNote({
      name: 'Leon',
      email: 'leon@example.com',
      message: '   ',
    }),
    { ok: false, error: 'message_required' },
  );
  assert.deepEqual(
    validateContactNote({
      name: 'Leon',
      email: 'leon@example.com',
      message: 'a'.repeat(MAX_CONTACT_MESSAGE_LENGTH + 1),
    }),
    { ok: false, error: 'message_too_long' },
  );

  // The value that comes back is the value that gets stored and mailed, so what
  // was checked is what is used.
  assert.deepEqual(
    validateContactNote({
      name: ' Leon  Lin ',
      email: ' Leon@Example.com ',
      message: ' hello\r\nworld ',
    }),
    {
      ok: true,
      value: {
        name: 'Leon Lin',
        email: 'Leon@Example.com',
        message: 'hello\nworld',
      },
    },
  );

  // The limits are inclusive, and a non-string field never validates.
  assert.equal(
    validateContactNote({
      name: 'a'.repeat(MAX_CONTACT_NAME_LENGTH),
      email: 'leon@example.com',
      message: 'a'.repeat(MAX_CONTACT_MESSAGE_LENGTH),
    }).ok,
    true,
  );
  assert.deepEqual(validateContactNote({ name: 1, email: {}, message: [] }), {
    ok: false,
    error: 'name_required',
  });

  // Only the path of this site's own page is kept; a full URL, a query string, or
  // anything else is reported as unknown rather than recorded as if it meant
  // something.
  assert.equal(normalizeSourcePage('/now'), '/now');
  assert.equal(normalizeSourcePage('  /about  '), '/about');
  assert.equal(
    normalizeSourcePage('/writing/some-post/'),
    '/writing/some-post/',
  );
  assert.equal(
    normalizeSourcePage('https://leonlins.com/now'),
    UNKNOWN_SOURCE_PAGE,
  );
  assert.equal(
    normalizeSourcePage('/now?utm_source=newsletter'),
    UNKNOWN_SOURCE_PAGE,
  );
  assert.equal(
    normalizeSourcePage(`/${'a'.repeat(MAX_CONTACT_SOURCE_LENGTH + 1)}`),
    UNKNOWN_SOURCE_PAGE,
  );
  assert.equal(
    normalizeSourcePage(`/${'a'.repeat(MAX_CONTACT_SOURCE_LENGTH - 1)}`),
    `/${'a'.repeat(MAX_CONTACT_SOURCE_LENGTH - 1)}`,
  );
  assert.equal(normalizeSourcePage(''), UNKNOWN_SOURCE_PAGE);
  assert.equal(normalizeSourcePage(null), UNKNOWN_SOURCE_PAGE);

  // Every error the API can return carries copy, a status the form can explain,
  // and the one field the browser should focus.
  for (const [code, entry] of Object.entries(contactErrors)) {
    assert.ok(entry.message.length > 0, `${code} needs a message`);
    assert.ok(
      [400, 403, 413, 503].includes(entry.status),
      `${code} must use a status the form can explain`,
    );
    if (entry.status >= 500 || entry.status === 413)
      assert.equal(entry.field, null, `${code} cannot name a field to fix`);
  }
  for (const code of ['name_required', 'name_too_long'] as const)
    assert.equal(contactErrors[code].field, 'name');
  for (const code of [
    'email_required',
    'email_invalid',
    'email_too_long',
  ] as const)
    assert.equal(contactErrors[code].field, 'email');
  for (const code of ['message_required', 'message_too_long'] as const)
    assert.equal(contactErrors[code].field, 'message');
  for (const code of ['invalid_request', 'too_large', 'cross_site'] as const)
    assert.equal(contactErrors[code].status < 500, true);
  // The errors that leave the reader without a confirmed send always name the
  // address that still works, because the form is never the only way to write
  // in — including the two states only the browser can reach.
  for (const code of [
    'verification_required',
    'verification_failed',
    'invalid_request',
    'too_large',
    'unavailable',
    'delivery_failed',
    'send_unconfirmed',
  ] as const)
    assert.ok(
      contactErrors[code].message.includes(CONTACT_EMAIL),
      `${code} must point at the address that always works`,
    );
}

export const CONTACT_URL = 'https://leonlins.com/api/contact';
export const CONTACT_ID = '2b0e5a2f-1c1a-4f0e-9f4d-5b3a7c1d2e3f';
export const CONTACT_NOTE = {
  name: 'Leon Lin',
  email: 'leon@example.com',
  message: 'Hello from the site',
  note_origin: '',
  turnstileToken: 'token',
};

/** A fake database that answers an insert with the stored row and an update with nothing. */
export function contactDbStub() {
  return makeFakeDb((query) =>
    /INSERT INTO contact_submissions/.test(query.text)
      ? [{ id: CONTACT_ID, created_at: '2026-09-17T10:00:00.000Z' }]
      : [],
  );
}

export function contactDeps(
  overrides: Partial<ContactHandlerDeps> = {},
): ContactHandlerDeps {
  return {
    db: contactDbStub().db,
    turnstileSecret: 'secret',
    fetchImpl: verifiedTurnstileFetch,
    env: {},
    notify: async () => {},
    ...overrides,
  };
}

/**
 * Turnstile's `siteverify` goes to `handleSiteverify` (which verifies by default)
 * and every other call goes to `handleOther`.
 */
export function contactFetch(
  handleOther: (url: string, init?: RequestInit) => Promise<Response>,
  handleSiteverify: (
    url: string,
    init?: RequestInit,
  ) => Promise<Response> = async () =>
    new Response(JSON.stringify({ success: true }), { status: 200 }),
): typeof fetch {
  return (async (url: string, init?: RequestInit) =>
    String(url).includes('siteverify')
      ? handleSiteverify(String(url), init)
      : handleOther(String(url), init)) as unknown as typeof fetch;
}

/** A fetch that refuses to be called, for cases that must stop before the network. */
export const forbiddenFetch = (async () => {
  throw new Error('this request must not reach the network');
}) as unknown as typeof fetch;

export function postContactNote(
  payload: Record<string, unknown>,
  deps: ContactHandlerDeps,
  headers: Record<string, string> = {},
) {
  return handleContactNote(
    new Request(CONTACT_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://leonlins.com',
        ...headers,
      },
      body: JSON.stringify(payload),
    }),
    deps,
  );
}

export type SentEmail = {
  input: {
    FromEmailAddress?: string;
    ReplyToAddresses?: string[];
    ConfigurationSetName?: string;
    Destination: { ToAddresses?: string[] };
    Content: {
      Simple: {
        Subject: { Data: string };
        Body: { Text: { Data: string }; Html: { Data: string } };
      };
    };
  };
};

export async function testContactNotifications() {
  const note: ContactNotification = {
    id: CONTACT_ID,
    name: 'Leon Lin',
    email: 'leon@example.com',
    message: 'Hello\n<world>',
    sourcePage: '/now',
    receivedAt: '2026-09-17T10:00:00.000Z',
  };

  // The subject names the sender and, when it is known, the page they wrote from.
  assert.equal(
    contactNotificationSubject(note),
    'New note from Leon Lin - /now',
  );
  assert.equal(
    contactNotificationSubject({
      name: 'Leon',
      sourcePage: UNKNOWN_SOURCE_PAGE,
    }),
    'New note from Leon',
  );
  assert.equal(
    contactNotificationSubject({ name: 'Leon', sourcePage: '' }),
    'New note from Leon',
  );
  // A subject is a header: a name with newlines must not be able to inject a
  // second header, which is why the name is collapsed before it arrives here.
  assert.ok(
    // eslint-disable-next-line no-control-regex -- asserting that no control character survives is the point.
    !/[\r\n\u0000-\u001f\u007f-\u009f]/.test(
      contactNotificationSubject({
        name: normalizeContactName('Leon\nBcc: someone@example.com'),
        sourcePage: '/now',
      }),
    ),
  );

  const bodies = buildContactNotification(note);
  assert.equal(bodies.subject, contactNotificationSubject(note));
  for (const fragment of [
    'Leon Lin',
    'leon@example.com',
    '/now',
    '2026-09-17T10:00:00.000Z',
    'Hello',
  ])
    assert.ok(bodies.text.includes(fragment), `text is missing ${fragment}`);
  assert.ok(bodies.text.includes('Reply to this email'));

  // The message is prose someone else wrote, so it is escaped and pre-wrapped,
  // and the mail carries no images, links, or tracking of any kind.
  assert.ok(!bodies.html.includes('<world>'));
  assert.ok(bodies.html.includes('&lt;world&gt;'));
  assert.match(bodies.html, /white-space: pre-wrap/);
  assert.ok(!/<(a|img|iframe|script|link)\b/i.test(bodies.html));
  assert.ok(!/https?:\/\//.test(bodies.html));

  // One verified sending identity, with the person who wrote in as Reply-To, so
  // answering the notification answers them.
  const sent: SentEmail[] = [];
  const sendOptions: unknown[] = [];
  await sendContactNotification(note, {
    client: {
      send: async (command: unknown, options?: unknown) => {
        sent.push(command as SentEmail);
        sendOptions.push(options);
        return {};
      },
    },
  });
  assert.equal(sent.length, 1);
  // The send carries a deadline of its own, so a stalled connection ends in a
  // visible failure rather than a request that outlives the reader's patience.
  assert.ok(
    (sendOptions[0] as { abortSignal?: AbortSignal } | undefined)
      ?.abortSignal instanceof AbortSignal,
    'the notification send must be bounded by a deadline',
  );
  assert.ok(NOTIFICATION_TIMEOUT_MS > 0);
  const { input } = sent[0] as SentEmail;
  assert.equal(input.FromEmailAddress, NEWSLETTER_FROM);
  assert.deepEqual(input.ReplyToAddresses, ['leon@example.com']);
  assert.deepEqual(input.Destination.ToAddresses, [CONTACT_EMAIL]);
  assert.equal(input.Content.Simple.Subject.Data, bodies.subject);
  assert.equal(input.Content.Simple.Body.Text.Data, bodies.text);
  assert.equal(input.Content.Simple.Body.Html.Data, bodies.html);
  // No configuration set: the SES/SNS pipeline a configuration set feeds is
  // reconciled against newsletter subscribers, and this is not subscriber mail.
  assert.equal(input.ConfigurationSetName, undefined);

  // A missing region is a configuration failure, not a silent no-op.
  const originalRegion = process.env.AWS_REGION;
  try {
    delete process.env.AWS_REGION;
    await assert.rejects(() => sendContactNotification(note), /AWS region/);
  } finally {
    if (originalRegion === undefined) delete process.env.AWS_REGION;
    else process.env.AWS_REGION = originalRegion;
  }
}

export async function testContactLinCheck() {
  // Both halves of the handoff configuration are required.
  assert.equal(linCheckConfig({}), null);
  assert.equal(
    linCheckConfig({ LIN_CHECK_INBOUND_URL: 'https://lin.example/inbound' }),
    null,
  );
  assert.equal(linCheckConfig({ LIN_CHECK_INBOUND_TOKEN: 'token' }), null);
  assert.equal(linCheckConfig({ LIN_CHECK_INBOUND_URL: '   ' }), null);
  // The handoff carries a bearer token, so a non-https endpoint counts as
  // unconfigured instead of putting the token on the wire in clear text.
  for (const endpoint of [
    'http://lin.example/inbound',
    'file:///etc/passwd',
    'not a url',
  ])
    assert.equal(
      linCheckConfig({
        LIN_CHECK_INBOUND_URL: endpoint,
        LIN_CHECK_INBOUND_TOKEN: 'token',
      }),
      null,
      `${endpoint} must not be used as the handoff endpoint`,
    );
  assert.deepEqual(
    linCheckConfig({
      LIN_CHECK_INBOUND_URL: ' https://lin.example/inbound ',
      LIN_CHECK_INBOUND_TOKEN: ' token ',
    }),
    { endpoint: 'https://lin.example/inbound', token: 'token' },
  );

  // An unconfigured handoff changes nothing about the note, so nothing else
  // reports it: the first note that could have been handed off says so once.
  const warnings = await withCapturedLogs(async () => {
    warnIfLinCheckUnconfigured();
    warnIfLinCheckUnconfigured();
  });
  assert.equal(
    warnings.length,
    1,
    'the unconfigured handoff is reported once per process',
  );
  assert.match(String(warnings[0][0]), /LIN_CHECK_INBOUND_URL/);

  const note = {
    id: CONTACT_ID,
    name: 'Leon Lin',
    email: 'leon@example.com',
    message: 'Hello',
    sourcePage: '/now',
    receivedAt: '2026-09-17T10:00:00.000Z',
  };

  // The payload is the whole contract: an inbound note and nothing about who the
  // sender might be. No Person, no Organization, no relationship, no verdict.
  const payload = linCheckPayload(note);
  assert.deepEqual(Object.keys(payload).sort(), [
    'email',
    'id',
    'kind',
    'message',
    'name',
    'receivedAt',
    'sourcePage',
  ]);
  assert.equal(payload.kind, 'website_note');

  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const respond = (status: number) =>
    ((url: string, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return Promise.resolve(new Response('', { status }));
    }) as unknown as typeof fetch;
  const env = {
    LIN_CHECK_INBOUND_URL: 'https://lin.example/inbound',
    LIN_CHECK_INBOUND_TOKEN: 'lin-check-token',
  };

  assert.equal(
    await handOffToLinCheck(note, { env, fetchImpl: respond(201) }),
    'sent',
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, 'https://lin.example/inbound');
  assert.equal(calls[0]?.init?.method, 'POST');
  const headers = calls[0]?.init?.headers as Record<string, string>;
  assert.equal(headers['content-type'], 'application/json');
  assert.equal(headers.authorization, `Bearer ${env.LIN_CHECK_INBOUND_TOKEN}`);
  // The stored submission id is the idempotency key, so a repeated handoff of the
  // same note cannot create a second inbound item.
  assert.equal(headers['idempotency-key'], CONTACT_ID);
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), payload);

  // A refusal from Lin Check, or a handoff that never answers, is a failure to
  // report and not a reason to lose the note: nothing is retried here.
  assert.equal(
    await handOffToLinCheck(note, { env, fetchImpl: respond(500) }),
    'failed',
  );
  assert.equal(
    await handOffToLinCheck(note, {
      env,
      fetchImpl: (async () => {
        throw new Error('offline');
      }) as unknown as typeof fetch,
    }),
    'failed',
  );
  // Nothing is attempted when the handoff is not configured.
  assert.equal(
    await handOffToLinCheck(note, { env: {}, fetchImpl: forbiddenFetch }),
    'unconfigured',
  );

  // A handoff that never answers is abandoned like any other failure. The
  // keep-alive timer is required because Node's `AbortSignal.timeout` timer is
  // unref'd: without another handle the process would exit instead of firing the
  // abort.
  const hanging = (async (_url: string, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () =>
        reject(new Error('lin check request timed out')),
      );
    })) as unknown as typeof fetch;
  const keepAlive = setTimeout(() => {}, 200);
  const startedAt = Date.now();
  try {
    assert.equal(
      await handOffToLinCheck(note, { env, fetchImpl: hanging, timeoutMs: 10 }),
      'failed',
    );
    assert.ok(
      Date.now() - startedAt < LIN_CHECK_TIMEOUT_MS,
      'the shortened timeout ends the wait, not the ten-second default',
    );
  } finally {
    clearTimeout(keepAlive);
  }
}

export async function testContactHandlers() {
  const jsonOf = async (response: Response) =>
    (await response.json()) as Record<string, unknown>;
  const captured: unknown[][] = [];

  // The handoff is not configured in these environments, and it reports that once
  // per process, so pin the state here rather than relying on suite order.
  await withCapturedLogs(async () => {
    warnIfLinCheckUnconfigured();
  });

  // --- the note that works ---------------------------------------------------
  const happy = contactDbStub();
  const notified: ContactNotification[] = [];
  const success = await postContactNote(
    {
      name: ' Leon  Lin ',
      email: 'leon@example.com',
      message: 'Hello\r\nworld',
      note_origin: '',
      turnstileToken: 'token',
    },
    contactDeps({
      db: happy.db,
      notify: async (note) => {
        notified.push(note);
      },
    }),
    { referer: 'https://leonlins.com/now?utm_source=newsletter' },
  );
  assert.equal(success.status, 200);
  assert.equal(success.headers.get('cache-control'), 'no-store');
  assert.equal(
    success.headers.get('content-type'),
    'application/json; charset=utf-8',
  );
  const successBody = await jsonOf(success);
  assert.deepEqual(successBody, {
    ok: true,
    message: CONTACT_SUCCESS_MESSAGE,
  });

  // Stored first, then notified: the row is the durable record of what someone
  // wrote, and it is written with the validated, normalized values.
  assert.equal(happy.queries.length, 2);
  const insert = soleQuery(happy.queries, /INSERT INTO contact_submissions/);
  assert.deepEqual(insert.values, [
    'Leon Lin',
    'leon@example.com',
    'Hello\nworld',
    '/now',
  ]);
  assert.deepEqual(notified, [
    {
      id: CONTACT_ID,
      name: 'Leon Lin',
      email: 'leon@example.com',
      message: 'Hello\nworld',
      sourcePage: '/now',
      receivedAt: '2026-09-17T10:00:00.000Z',
    },
  ]);
  // Delivery bookkeeping is a separate write, after the mail was accepted, and it
  // only ever touches this one row.
  const marked = soleQuery(happy.queries, /UPDATE contact_submissions/);
  assert.deepEqual(marked.values, [CONTACT_ID]);
  assert.match(marked.text, /SET notified_at = now\(\)/);
  assert.match(marked.text, /notified_at IS NULL/);

  // --- the page a note came from --------------------------------------------
  for (const [headers, expected] of [
    [{ referer: 'https://leonlins.com/now' }, '/now'],
    [
      { referer: 'https://leonlins.com/writing/a-post/?utm_source=x' },
      '/writing/a-post/',
    ],
    [{ referer: 'https://elsewhere.example/now' }, UNKNOWN_SOURCE_PAGE],
    [{ referer: 'not a url' }, UNKNOWN_SOURCE_PAGE],
    [{}, UNKNOWN_SOURCE_PAGE],
  ] as Array<[Record<string, string>, string]>) {
    const db = contactDbStub();
    const response = await postContactNote(
      CONTACT_NOTE,
      contactDeps({ db: db.db }),
      headers,
    );
    assert.equal(response.status, 200);
    assert.equal(
      soleQuery(db.queries, /INSERT INTO contact_submissions/).values[3],
      expected,
      `referer ${headers.referer ?? '(none)'}`,
    );
  }

  // The source page is never taken from the request body.
  const spoofed = contactDbStub();
  await postContactNote(
    { ...CONTACT_NOTE, sourcePage: 'https://attacker.example/funnel' },
    contactDeps({ db: spoofed.db }),
  );
  assert.equal(
    soleQuery(spoofed.queries, /INSERT INTO contact_submissions/).values[3],
    UNKNOWN_SOURCE_PAGE,
  );

  // --- nothing is stored for a bot ------------------------------------------
  let honeypotNotified = 0;
  const honeypot = await postContactNote(
    { ...CONTACT_NOTE, note_origin: 'http://spam.example', name: 'Bot' },
    contactDeps({
      db: makeForbiddenDb().db,
      notify: async () => {
        honeypotNotified += 1;
      },
    }),
  );
  assert.deepEqual(
    await jsonOf(honeypot),
    successBody,
    'a filled honeypot gets the same answer as a person, and stores nothing',
  );
  assert.equal(honeypotNotified, 0);

  // --- verification ----------------------------------------------------------
  captured.push(
    await withCapturedLogs(async () => {
      const response = await postContactNote(
        CONTACT_NOTE,
        contactDeps({
          db: makeForbiddenDb().db,
          turnstileSecret: '',
          fetchImpl: forbiddenFetch,
        }),
      );
      assert.equal(response.status, 503);
      assert.equal((await jsonOf(response)).error, 'unavailable');
    }),
  );
  assert.deepEqual(captured[0], [
    ['contact_refused', { reason: 'turnstile_unconfigured' }],
  ]);

  captured.push(
    await withCapturedLogs(async () => {
      const response = await postContactNote(
        CONTACT_NOTE,
        contactDeps({
          db: makeForbiddenDb().db,
          fetchImpl: (async () =>
            new Response('', { status: 500 })) as unknown as typeof fetch,
        }),
      );
      assert.equal(response.status, 503);
    }),
  );
  assert.deepEqual(captured[1], [
    ['contact_refused', { reason: 'turnstile_unavailable' }],
  ]);

  captured.push(
    await withCapturedLogs(async () => {
      for (const payload of [
        // A missing token never reaches Cloudflare.
        { ...CONTACT_NOTE, turnstileToken: '' },
        CONTACT_NOTE,
      ]) {
        const response = await postContactNote(
          payload,
          contactDeps({
            db: makeForbiddenDb().db,
            // Cloudflare answers, but it does not accept the token.
            fetchImpl: contactFetch(
              forbiddenFetch,
              async () =>
                new Response(JSON.stringify({ success: false }), {
                  status: 200,
                }),
            ),
          }),
        );
        assert.equal(response.status, 400);
        assert.deepEqual(await jsonOf(response), {
          ok: false,
          error: 'verification_failed',
          message: contactErrors.verification_failed.message,
          field: null,
        });
      }
    }),
  );
  assert.deepEqual(captured[2], [
    ['contact_refused', { reason: 'turnstile_invalid' }],
    ['contact_refused', { reason: 'turnstile_invalid' }],
  ]);

  // A Turnstile token can only be redeemed once, so a repeated submit is refused
  // instead of storing the note a second time.
  let verifications = 0;
  const singleUseFetch = contactFetch(forbiddenFetch, async () => {
    verifications += 1;
    return new Response(JSON.stringify({ success: verifications === 1 }), {
      status: 200,
    });
  });
  captured.push(
    await withCapturedLogs(async () => {
      const db = contactDbStub();
      const deps = contactDeps({ db: db.db, fetchImpl: singleUseFetch });
      assert.equal((await postContactNote(CONTACT_NOTE, deps)).status, 200);
      assert.equal((await postContactNote(CONTACT_NOTE, deps)).status, 400);
      assert.equal(
        db.queries.filter((query) =>
          /INSERT INTO contact_submissions/.test(query.text),
        ).length,
        1,
        'a repeated submit stores the note once',
      );
    }),
  );
  assert.deepEqual(captured[3], [
    ['contact_refused', { reason: 'turnstile_invalid' }],
  ]);

  // --- the request itself ----------------------------------------------------
  const crossSite = await postContactNote(CONTACT_NOTE, contactDeps(), {
    origin: 'https://evil.example',
  });
  assert.equal(crossSite.status, 403);
  assert.deepEqual(await jsonOf(crossSite), {
    ok: false,
    error: 'cross_site',
    message: contactErrors.cross_site.message,
    field: null,
  });
  // A 403 nobody can see is indistinguishable from a reader's mistake, so the
  // one refusal a preview deployment or a mistyped origin produces is logged.
  assert.deepEqual(
    await withCapturedLogs(async () => {
      await postContactNote(CONTACT_NOTE, contactDeps(), {
        origin: 'https://evil.example',
      });
    }),
    [['contact_refused', { reason: 'cross_site' }]],
  );

  captured.push(
    await withCapturedLogs(async () => {
      const post = (body: string | undefined) =>
        handleContactNote(
          new Request(CONTACT_URL, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              origin: 'https://leonlins.com',
            },
            ...(body === undefined ? {} : { body }),
          }),
          contactDeps({ db: makeForbiddenDb().db }),
        );
      for (const [body, expected] of [
        [undefined, 'invalid_request'],
        ['', 'invalid_request'],
        ['not json', 'invalid_request'],
        ['[]', 'invalid_request'],
        ['"a string"', 'invalid_request'],
        [
          JSON.stringify({
            message: 'a'.repeat(MAX_CONTACT_REQUEST_BYTES + 1),
          }),
          'too_large',
        ],
      ] as Array<[string | undefined, string]>) {
        const response = await post(body);
        assert.equal(
          (await jsonOf(response)).error,
          expected,
          `body ${String(body).slice(0, 20)}`,
        );
      }
    }),
  );
  assert.deepEqual(captured[4], [], 'a malformed request is not a failure');

  // --- a missing database ----------------------------------------------------
  captured.push(
    await withCapturedLogs(async () => {
      const response = await postContactNote(
        CONTACT_NOTE,
        contactDeps({ db: null, fetchImpl: forbiddenFetch }),
      );
      assert.equal(response.status, 503);
      assert.deepEqual(await jsonOf(response), {
        ok: false,
        error: 'unavailable',
        message: contactErrors.unavailable.message,
        field: null,
      });
    }),
  );
  assert.deepEqual(captured[5], [
    ['contact_refused', { reason: 'db_unconfigured' }],
  ]);

  // --- validation ------------------------------------------------------------
  for (const [payload, code, field] of [
    [
      { name: '  ', email: 'leon@example.com', message: 'hi' },
      'name_required',
      'name',
    ],
    [{ name: 'Leon', email: 'nope', message: 'hi' }, 'email_invalid', 'email'],
    [
      { name: 'Leon', email: 'leon@example.com', message: ' ' },
      'message_required',
      'message',
    ],
  ] as Array<[Record<string, unknown>, keyof typeof contactErrors, string]>) {
    const response = await postContactNote(
      { ...CONTACT_NOTE, ...payload },
      contactDeps({ db: makeForbiddenDb().db }),
    );
    assert.equal(response.status, 400);
    assert.deepEqual(await jsonOf(response), {
      ok: false,
      error: code,
      message: contactErrors[code].message,
      field,
    });
  }

  // --- the note that could not be stored ------------------------------------
  captured.push(
    await withCapturedLogs(async () => {
      let notifiedCount = 0;
      const response = await postContactNote(
        CONTACT_NOTE,
        contactDeps({
          db: makeFakeDb(() => {
            throw new Error(`insert failed for ${CONTACT_NOTE.email}`);
          }).db,
          notify: async () => {
            notifiedCount += 1;
          },
        }),
      );
      assert.equal(response.status, 503);
      assert.deepEqual(await jsonOf(response), {
        ok: false,
        error: 'unavailable',
        message: contactErrors.unavailable.message,
        field: null,
      });
      assert.equal(notifiedCount, 0, 'an unstored note is never announced');
    }),
  );
  assert.deepEqual(captured[6], [
    ['contact_alert', { kind: 'submission_store_failure', errorName: 'Error' }],
  ]);

  // --- the note that could not be delivered ---------------------------------
  captured.push(
    await withCapturedLogs(async () => {
      const db = contactDbStub();
      const response = await postContactNote(
        CONTACT_NOTE,
        contactDeps({
          db: db.db,
          notify: async () => {
            throw new Error(`SES rejected ${CONTACT_NOTE.email}`);
          },
        }),
      );
      assert.equal(response.status, 503);
      assert.deepEqual(await jsonOf(response), {
        ok: false,
        error: 'delivery_failed',
        message: contactErrors.delivery_failed.message,
        field: null,
      });
      // The row stays unfinished, so the note is still findable and answerable by
      // hand, and the handoff is not attempted for a note that did not go out.
      assert.equal(db.queries.length, 1);
      assert.match(
        db.queries[0]?.text ?? '',
        /INSERT INTO contact_submissions/,
      );
    }),
  );
  assert.deepEqual(captured[7], [
    ['contact_alert', { kind: 'notification_failure', errorName: 'Error' }],
  ]);

  // The real notification path is SES, and a missing region fails visibly rather
  // than quietly dropping the note.
  const originalRegion = process.env.AWS_REGION;
  try {
    delete process.env.AWS_REGION;
    captured.push(
      await withCapturedLogs(async () => {
        const db = contactDbStub();
        const response = await postContactNote(
          CONTACT_NOTE,
          contactDeps({ db: db.db, notify: undefined }),
        );
        assert.equal(response.status, 503);
        assert.equal(db.queries.length, 1);
      }),
    );
  } finally {
    if (originalRegion === undefined) delete process.env.AWS_REGION;
    else process.env.AWS_REGION = originalRegion;
  }
  assert.deepEqual(captured[8], [
    ['contact_alert', { kind: 'notification_failure', errorName: 'Error' }],
  ]);

  // --- the Lin Check handoff -------------------------------------------------
  const linEnv = {
    LIN_CHECK_INBOUND_URL: 'https://lin.example/inbound',
    LIN_CHECK_INBOUND_TOKEN: 'lin-check-token',
  };
  const synced = contactDbStub();
  const handoffCalls: string[] = [];
  const handoff = await postContactNote(
    CONTACT_NOTE,
    contactDeps({
      db: synced.db,
      env: linEnv,
      fetchImpl: contactFetch(async (url) => {
        handoffCalls.push(url);
        return new Response('', { status: 202 });
      }),
    }),
  );
  assert.equal(handoff.status, 200);
  assert.equal(handoffCalls.length, 1);
  // Two separate writes, in order: the note is recorded as delivered, and only
  // then is the handoff recorded. A delivered note is never left looking like
  // one nobody received.
  assert.deepEqual(
    synced.queries
      .filter((query) => /UPDATE contact_submissions/.test(query.text))
      .map((query) => query.text.includes('lin_check_synced_at')),
    [false, true],
    'the delivery record is written before the handoff is recorded',
  );

  const unsynced = contactDbStub();
  captured.push(
    await withCapturedLogs(async () => {
      const response = await postContactNote(
        CONTACT_NOTE,
        contactDeps({
          db: unsynced.db,
          env: linEnv,
          fetchImpl: contactFetch(async () => {
            throw new Error('lin check is down');
          }),
        }),
      );
      // The note was stored and emailed, so the reader is not asked to retry.
      assert.equal(response.status, 200);
    }),
  );
  assert.deepEqual(captured[9], [
    ['contact_alert', { kind: 'lin_check_failure' }],
  ]);
  // A failed handoff records the delivery and nothing else: the row is
  // unfinished only for the handoff, which the alert line reports.
  assert.deepEqual(
    unsynced.queries
      .filter((query) => /UPDATE contact_submissions/.test(query.text))
      .map((query) => query.text.includes('lin_check_synced_at')),
    [false],
  );

  // --- the delivered note whose bookkeeping failed --------------------------
  captured.push(
    await withCapturedLogs(async () => {
      const db = makeFakeDb((query) => {
        if (/INSERT INTO contact_submissions/.test(query.text))
          return [{ id: CONTACT_ID, created_at: '2026-09-17T10:00:00.000Z' }];
        throw new Error('update failed');
      });
      const response = await postContactNote(
        CONTACT_NOTE,
        contactDeps({ db: db.db }),
      );
      assert.equal(response.status, 200);
    }),
  );
  assert.deepEqual(captured[10], [
    ['contact_alert', { kind: 'delivery_record_failure', errorName: 'Error' }],
  ]);

  // --- nothing about a person reaches a log ---------------------------------
  const alertKinds = new Set<string>();
  for (const calls of captured) {
    const serialized = JSON.stringify(calls);
    for (const secret of [
      CONTACT_NOTE.email,
      CONTACT_NOTE.message,
      CONTACT_NOTE.name,
      CONTACT_ID,
    ])
      assert.ok(
        !serialized.includes(secret),
        `no log may carry ${secret.slice(0, 12)}`,
      );
    for (const call of calls as unknown[][]) {
      if (call[0] === 'contact_alert') {
        const fields = call[1] as { kind: string; errorName?: string };
        assert.deepEqual(Object.keys(fields), [
          'kind',
          ...(fields.errorName === undefined ? [] : ['errorName']),
        ]);
        alertKinds.add(fields.kind);
      } else {
        assert.equal(call[0], 'contact_refused');
        assert.deepEqual(Object.keys(call[1] as object), ['reason']);
      }
    }
  }
  assert.deepEqual(
    [...alertKinds].sort(),
    [...contactAlertKinds].sort(),
    'every alert kind the flow can raise is exercised and documented',
  );

  // --- the request carries no network identifiers ---------------------------
  const withNetworkHeaders = contactDbStub();
  await postContactNote(
    CONTACT_NOTE,
    contactDeps({ db: withNetworkHeaders.db }),
    {
      'x-forwarded-for': '203.0.113.7',
      'cf-connecting-ip': '203.0.113.7',
      'x-real-ip': '203.0.113.7',
      'user-agent': 'curl/8.5.0',
    },
  );
  assert.ok(
    !JSON.stringify(withNetworkHeaders.queries).includes('203.0.113.7'),
    'no IP address is stored with a note',
  );
  assert.ok(!JSON.stringify(withNetworkHeaders.queries).includes('curl/8.5.0'));
}

export async function testContactStoreSql() {
  const insert = contactDbStub();
  const stored = await createContactSubmission(insert.db, {
    name: 'Leon Lin',
    email: 'leon@example.com',
    message: 'Hello',
    sourcePage: '/now',
  });
  assert.deepEqual(stored, {
    id: CONTACT_ID,
    createdAt: '2026-09-17T10:00:00.000Z',
  });
  assert.equal(insert.queries.length, 1);
  assert.match(
    insert.queries[0]?.text ?? '',
    /INSERT INTO contact_submissions \(name, email, message, source_page\)/,
  );
  assert.match(insert.queries[0]?.text ?? '', /RETURNING id, created_at/);
  assert.deepEqual(insert.queries[0]?.values, [
    'Leon Lin',
    'leon@example.com',
    'Hello',
    '/now',
  ]);
  // The insert is the note and nothing else: delivery state is written later, so
  // an unfinished row stays findable.
  assert.ok(
    !/notified_at|lin_check_synced_at/.test(insert.queries[0]?.text ?? ''),
  );

  // Timestamps are either ISO or empty, never a plausible-looking substitute for
  // a value the database did not return in a usable shape.
  const unparseable = makeFakeDb(() => [
    { id: CONTACT_ID, created_at: 'not a timestamp' },
  ]);
  assert.equal(
    (
      await createContactSubmission(unparseable.db, {
        name: 'Leon Lin',
        email: 'leon@example.com',
        message: 'Hello',
        sourcePage: '/now',
      })
    ).createdAt,
    '',
  );

  // A note the database did not store is an error, not a silent success.
  await assert.rejects(
    () =>
      createContactSubmission(makeFakeDb(() => []).db, {
        name: 'Leon',
        email: 'leon@example.com',
        message: 'Hello',
        sourcePage: '/now',
      }),
    /not stored/,
  );

  // Delivery state is written in two steps: the notification timestamp first, so
  // a delivered note can never be left looking like a note nobody was told about,
  // and the handoff timestamp only when a handoff actually happened.
  const update = makeFakeDb(() => []);
  await markContactNotified(update.db, CONTACT_ID);
  await markContactLinCheckSynced(update.db, CONTACT_ID);
  assert.equal(update.queries.length, 2);
  assert.match(update.queries[0]?.text ?? '', /UPDATE contact_submissions/);
  assert.match(update.queries[0]?.text ?? '', /SET notified_at = now\(\)/);
  assert.match(
    update.queries[0]?.text ?? '',
    /WHERE id =\s+\{\?\}\s+::uuid AND notified_at IS NULL/,
  );
  assert.deepEqual(update.queries[0]?.values, [CONTACT_ID]);
  assert.match(update.queries[1]?.text ?? '', /UPDATE contact_submissions/);
  assert.match(
    update.queries[1]?.text ?? '',
    /SET lin_check_synced_at = now\(\)/,
  );
  assert.match(
    update.queries[1]?.text ?? '',
    /WHERE id =\s+\{\?\}\s+::uuid AND lin_check_synced_at IS NULL/,
  );
  assert.deepEqual(update.queries[1]?.values, [CONTACT_ID]);
  // Neither statement can overwrite a timestamp that is already set, so a
  // retried request cannot rewrite when a note was delivered.
  assert.ok(
    !/notified_at\s*=\s*now\(\),\s*lin_check/.test(
      update.queries[0]?.text ?? '',
    ),
  );
}

export function testContactIntegrationBoundaries() {
  const read = (relativePath: string) =>
    fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf-8');
  const component = read('src/components/ContactNote.astro');

  // Every invitation uses the one component, and no page defines its own form.
  for (const page of ['about', 'now', 'contact']) {
    const source = read(`src/pages/${page}.astro`);
    assert.match(
      source,
      /import ContactNote from '\.\.\/components\/ContactNote\.astro'/,
      `${page} must reuse the shared contact component`,
    );
    assert.match(source, /<ContactNote/);
    assert.ok(
      !/<form/.test(source),
      `${page} must not define a second contact form`,
    );
    // The invitation must not hydrate: these pages stay static.
    assert.ok(!/client:(load|visible|idle|media|only)/.test(source));
  }
  // The dedicated page opens the form directly; the in-page invitation is
  // progressive and starts collapsed.
  assert.match(read('src/pages/contact.astro'), /<ContactNote expanded \/>/);
  assert.equal(
    read('src/pages/now.astro').match(/<ContactNote \/>/g)?.length,
    1,
  );
  assert.match(component, /hidden=\{!expanded\}/);
  assert.match(component, /aria-expanded=\{expanded \? 'true' : 'false'\}/);
  assert.match(component, /aria-controls=\{formId\}/);
  // The island script addresses the markup by id, and a mismatch leaves a
  // button that does nothing, so the two are resolved and compared.
  const formId = component.match(/const formId = '([^']+)'/)?.[1] ?? '';
  const toggleSuffix = component.match(
    /const toggleId = `\$\{formId\}([^`]*)`/,
  )?.[1];
  assert.ok(
    formId !== '' && toggleSuffix !== undefined,
    'the ids must stay composed from one base',
  );
  assert.match(component, /id=\{formId\}/);
  assert.match(component, /id=\{toggleId\}/);
  assert.match(
    component,
    new RegExp(`document\\.getElementById\\('${formId}'\\)`),
    'the script must find the form the markup renders',
  );
  assert.match(
    component,
    new RegExp(`document\\.getElementById\\('${formId}${toggleSuffix}'\\)`),
    'the script must find the toggle the markup renders',
  );
  // The toggle is worded, not a bare icon, and only the address is offered when
  // no site key is configured.
  assert.match(component, /Or use the contact form/);
  assert.match(component, /Email me at/);

  // Exactly three fields, plus the honeypot, which a person cannot reach.
  assert.equal(component.match(/<input\b|<textarea\b/g)?.length, 4);
  assert.match(component, /name="name"/);
  assert.match(component, /name="email"/);
  assert.match(component, /name="message"/);
  assert.match(component, /name="note_origin"/);
  assert.match(component, /<div class="contact-honeypot" aria-hidden="true">/);
  assert.match(component, /tabindex="-1"/);
  assert.match(component, /autocomplete="off"/);
  // The trap must not be named or labelled with a word browsers autofill: an
  // autofilled honeypot answers a real note with a fake success and loses it.
  assert.ok(
    !/name="(?:website|url|company|organization|address|username)"/.test(
      component,
    ),
    'the honeypot must avoid browser autofill vocabulary',
  );
  // The limits the browser enforces are the limits the server enforces.
  assert.match(component, /maxlength=\{MAX_CONTACT_NAME_LENGTH\}/);
  assert.match(component, /maxlength=\{MAX_CONTACT_EMAIL_LENGTH\}/);
  assert.match(component, /maxlength=\{MAX_CONTACT_MESSAGE_LENGTH\}/);
  assert.ok(
    !/MAX_CONTACT_SOURCE_LENGTH/.test(component),
    'a page reference is not something a person types',
  );

  // The form posts JSON to the endpoint, and the page it was sent from is never
  // something the browser decides.
  assert.match(component, /const ENDPOINT = '\/api\/contact'/);
  assert.ok(
    !/sourcePage/.test(component),
    'the source page is derived server-side from the Referer',
  );
  // Submitting is bounded and repeatable: the button is disabled in flight, the
  // request times out, and the single-use token is reset after every attempt.
  assert.match(component, /if \(submitting\) return;/);
  assert.match(component, /submit\.disabled = true/);
  assert.match(component, /AbortSignal\.timeout\(REQUEST_TIMEOUT_MS\)/);
  // The server's own send has to finish inside the reader's wait, or the reader
  // is told the note may not have arrived while it is still being delivered.
  const clientWaitMs = Number(
    component.match(/REQUEST_TIMEOUT_MS = ([\d_]+)/)?.[1]?.replaceAll('_', ''),
  );
  assert.ok(
    Number.isFinite(clientWaitMs) && NOTIFICATION_TIMEOUT_MS < clientWaitMs,
    'the notification deadline must sit inside the reader’s own wait',
  );
  assert.match(component, /resetVerification\(\)/);
  assert.match(component, /form\.reset\(\)/);
  // The server's message is what the reader sees, so the two never disagree.
  assert.match(component, /contactErrors\.unavailable\.message/);
  assert.match(component, /contactErrors\.verification_required\.message/);
  // A network failure is not a delivery failure: the note may already be stored,
  // so the client must not invite a resend that would store it twice.
  assert.match(component, /contactErrors\.send_unconfirmed\.message/);
  assert.ok(
    !/catch \{[\s\S]*?contactErrors\.unavailable\.message/.test(component),
    'an unanswered request must not be reported as an unavailable form',
  );
  // An expired or failed widget clears its token, so the check is reset rather
  // than leaving the reader waiting for a token that is not coming.
  assert.match(
    component,
    /if \(!token\) \{[\s\S]*?resetVerification\(\);[\s\S]*?return;/,
  );
  // A response whose body cannot be read is still judged by its status: an
  // accepted note must never be reported as a failure.
  assert.match(
    component,
    /: response\.ok\s*\?\s*CONTACT_SUCCESS_MESSAGE\s*:\s*contactErrors\.unavailable\.message/,
  );
  assert.match(component, /role="status"/);
  assert.match(component, /aria-live="polite"/);

  // Turnstile is rendered explicitly, follows the page theme, and its script is
  // only fetched once someone asks for the form. The browser half is shared with
  // the discussion island, so the script URL and the single-load guard are
  // asserted once, against the module both callers use.
  assert.match(component, /data-contact-turnstile/);
  assert.match(component, /theme: pageTheme\(\)/);
  assert.match(
    component,
    /loadTurnstileScript\(renderWidget\);\n\s*fields\.name\.focus\(\);/,
  );
  const turnstileClient = read('src/lib/turnstile-client.ts');
  assert.match(turnstileClient, /render=explicit/);
  assert.match(turnstileClient, /script\.dataset\.turnstileExplicit = 'true'/);
  assert.match(turnstileClient, /'script\[data-turnstile-explicit\]'/);
  // Collapsing must not leave focus inside a form that is no longer rendered.
  assert.match(component, /if \(!next\) \{[\s\S]*?toggle\.focus\(\);/);
  // A missing site key removes the form entirely and says so in the build log,
  // rather than offering a form that can never pass verification.
  assert.match(component, /warnIfSiteKeyMissing\(/);
  assert.match(component, /\[contact\] PUBLIC_TURNSTILE_SITE_KEY/);
  assert.match(component, /siteKey && \(/);
  assert.match(
    component,
    /turnstileSiteKey\(import\.meta\.env\.PUBLIC_TURNSTILE_SITE_KEY\)/,
  );
  // The style has to beat the form's own layout once script reveals it.
  assert.match(component, /\.contact-form\[hidden\] \{[\s\S]*?display: none;/);
  assert.match(component, /CONTACT_EMAIL/);

  // The invitation is not a navigation item, and the dedicated page is not
  // advertised in the chrome.
  for (const file of [
    'src/components/Header.astro',
    'src/components/Footer.astro',
  ])
    assert.ok(
      !/contact/i.test(read(file)),
      `${file} must stay as it is: contact is an invitation, not a navigation item`,
    );

  // One on-demand route, writing through the shared handler and connection helper.
  const route = read('src/pages/api/contact.ts');
  assert.match(route, /export const prerender = false/);
  assert.match(route, /export const POST/);
  assert.ok(!/export const GET/.test(route), 'notes are write-only');
  assert.match(route, /import \{ tryNeonDb \}/);
  assert.match(route, /handleContactNote\(request, \{ db: tryNeonDb\(\) \}\)/);

  // A same-origin JSON POST is the only shape the form sends, so the existing
  // middleware gate covers it without a new exemption.
  assert.equal(
    requiresOriginRejection(
      new Request(CONTACT_URL, {
        method: 'POST',
        headers: {
          origin: 'https://leonlins.com',
          'content-type': 'application/json',
        },
      }),
      false,
    ),
    false,
  );

  // One table, whose constraints mirror the limits the code enforces.
  const migration = read('migrations/contact/001_initial.sql');
  assert.equal(
    migration.match(/CREATE TABLE/g)?.length,
    1,
    'the contact flow stays one table',
  );
  for (const fragment of [
    'id UUID PRIMARY KEY DEFAULT gen_random_uuid()',
    'name TEXT NOT NULL',
    'email TEXT NOT NULL',
    'message TEXT NOT NULL',
    "source_page TEXT NOT NULL DEFAULT 'unknown'",
    'created_at TIMESTAMPTZ NOT NULL DEFAULT now()',
    'notified_at TIMESTAMPTZ',
    'lin_check_synced_at TIMESTAMPTZ',
    `char_length(name) BETWEEN 1 AND ${MAX_CONTACT_NAME_LENGTH}`,
    `char_length(email) BETWEEN 3 AND ${MAX_CONTACT_EMAIL_LENGTH}`,
    `char_length(message) BETWEEN 1 AND ${MAX_CONTACT_MESSAGE_LENGTH}`,
    `char_length(source_page) BETWEEN 1 AND ${MAX_CONTACT_SOURCE_LENGTH}`,
  ])
    assert.ok(
      migration.includes(fragment),
      `the migration must keep ${fragment}`,
    );
  assert.equal(
    migration.match(/CREATE (TABLE|INDEX) IF NOT EXISTS/g)?.length,
    2,
    're-running the migration is a no-op instead of an error',
  );
  // The unfinished work an operator has to look at is one indexed query. Only a
  // note that was never delivered is unfinished: a handoff that did not happen is
  // reported by the alert line, not by a second predicate here.
  assert.match(
    migration,
    /ON contact_submissions \(created_at\)[\s\S]*?WHERE notified_at IS NULL;/,
  );
  // A note carries no network identifier and no browser token.
  assert.ok(!/\bip\b|inet|user_agent|token/i.test(migration));

  // The failure vocabulary is closed, and an alert never carries payload fields.
  assert.deepEqual(
    [...contactAlertKinds],
    [
      'submission_store_failure',
      'notification_failure',
      'delivery_record_failure',
      'lin_check_failure',
    ],
  );
  const handlers = read('src/lib/contact/handlers.ts');
  assert.ok(
    !/error\.message/.test(handlers),
    'an error message quotes the data that caused it and never reaches a log',
  );

  // The handoff owns one outbound call and no database of its own.
  const linCheck = read('src/lib/contact/lin-check.ts');
  assert.match(linCheck, /LIN_CHECK_INBOUND_URL/);
  assert.match(linCheck, /LIN_CHECK_INBOUND_TOKEN/);
  assert.match(linCheck, /'idempotency-key': note\.id/);
  assert.ok(
    !/INSERT INTO|UPDATE contact|DELETE FROM/i.test(linCheck),
    'the handoff reports an inbound; it never writes to a database itself',
  );

  // Delivery reuses the newsletter's verified identity and the existing packages,
  // with no new mail provider.
  const packageJson = JSON.parse(read('package.json')) as {
    dependencies: Record<string, string>;
  };
  for (const dependency of [
    '@aws-sdk/client-sesv2',
    '@neondatabase/serverless',
  ])
    assert.ok(
      packageJson.dependencies[dependency],
      `${dependency} must already be a dependency`,
    );

  // The privacy policy says what a note stores and what it does not.
  const privacy = read('src/pages/privacy.astro');
  assert.match(privacy, /notes? sent from the contact form/i);
  assert.match(privacy, /does not store IP addresses,\s+browser tokens/i);
  // Documentation for whoever operates this.
  assert.ok(fs.existsSync(path.join(REPO_ROOT, 'docs/contact.md')));
  const docs = read('docs/contact.md');
  for (const fragment of [
    'contact_submissions',
    'LIN_CHECK_INBOUND_URL',
    'LIN_CHECK_INBOUND_TOKEN',
    'Idempotency-Key',
    'TURNSTILE_SECRET_KEY',
  ])
    assert.ok(
      docs.includes(fragment),
      `docs/contact.md must document ${fragment}`,
    );
  assert.match(read('README.md'), /docs\/contact\.md/);
  assert.match(read('AGENTS.md'), /contact_submissions/);
}

export async function runContactTests() {
  await testContactDomain();
  await testContactNotifications();
  await testContactLinCheck();
  await testContactHandlers();
  await testContactStoreSql();
  await testContactIntegrationBoundaries();
}
