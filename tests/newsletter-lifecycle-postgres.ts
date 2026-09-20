// Opt-in integration test for the subscriber lifecycle SQL against a
// disposable local Postgres cluster only. NEWSLETTER_TEST_PG_SOCKET must be a
// private /tmp directory; this never uses DATABASE_URL.
//
// The fake-database tests in tests/run-tests.ts assert the statements the
// lifecycle issues; this harness proves the same statements behave that way
// against the real schema, which is the only place the status guard on a
// resubscription, the single-use confirmation token, and the cancellation
// timestamps can be checked for real.
//
//   export PATH=$PATH:/usr/lib/postgresql/16/bin
//   NEWSLETTER_TEST_PG_SOCKET=/tmp/newsletter-lifecycle-pg-test \
//     node --import ./tests/register-loaders.mjs --loader ts-node/esm \
//     tests/newsletter-lifecycle-postgres.ts
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { hashToken } from '../src/lib/newsletter/tokens.ts';
import type { NeonDb } from '../src/lib/neon.ts';
import {
  confirmSubscription,
  requestSubscription,
  unsubscribe,
} from '../src/lib/newsletter/subscriptions.ts';

const socket = process.env.NEWSLETTER_TEST_PG_SOCKET;
assert.match(socket ?? '', /^\/tmp\/newsletter-lifecycle-pg-[A-Za-z0-9]+$/);
const schema = 'newsletter_lifecycle_test';
const env = {
  PATH: process.env.PATH,
  PGUSER: process.env.PGUSER ?? 'postgres',
  PGOPTIONS: `-c search_path=${schema},public`,
};

function sql(query: string): string {
  return execFileSync(
    'psql',
    [
      '-X',
      '-h',
      socket!,
      '-p',
      '55439',
      '-d',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
      '-At',
    ],
    { input: query, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], env },
  ).trim();
}

function literal(value: unknown): string {
  if (value === null) return 'NULL';
  if (value instanceof Date) return `'${value.toISOString()}'::timestamptz`;
  return `'${String(value).replaceAll("'", "''")}'`;
}

// Both shapes are needed: SELECTs are wrapped as a subquery and statements that
// return rows are wrapped as a data-modifying CTE, so every statement the
// lifecycle issues can be read back through the same shim the application uses.
// `template` is the statement as written — without interpolated values — so the
// shape of the statement decides how it is read back, not what it happens to
// contain.
function run(template: string, statement: string): unknown[] {
  const shape = template.trim();
  const parse = (query: string) => JSON.parse(sql(query)) as unknown[];
  // A data-modifying statement has to be the outermost statement, so it is
  // wrapped as a CTE rather than as a subquery.
  if (/\bRETURNING\b/i.test(shape))
    return parse(
      `WITH modified AS (${statement}) SELECT COALESCE(json_agg(row_to_json(modified)), '[]'::json) FROM modified`,
    );
  if (/^(SELECT|WITH)/i.test(shape))
    return parse(
      `SELECT COALESCE(json_agg(row_to_json(rows)), '[]'::json) FROM (${statement}) rows`,
    );
  sql(statement);
  return [];
}

const db = (async (parts: TemplateStringsArray, ...values: unknown[]) =>
  run(
    parts.join('\n'),
    parts.reduce(
      (text, part, index) =>
        text + part + (index < values.length ? literal(values[index]) : ''),
      '',
    ),
  )) as unknown as NeonDb;

type SubscriberRow = {
  status: string;
  confirmation_token_hash: string | null;
  unsubscribe_token_hash: string;
  confirmed_at: string | null;
  unsubscribed_at: string | null;
  acquisition_source: string | null;
  utm_campaign: string | null;
  consent_provenance: string;
  created_at: string;
  updated_at: string;
};

function subscriberRow(email: string): SubscriberRow {
  const rows = run(
    'SELECT * FROM subscribers',
    `SELECT * FROM subscribers WHERE email_normalized = ${literal(email)}`,
  ) as SubscriberRow[];
  assert.equal(rows.length, 1, `${email} must exist exactly once`);
  return rows[0];
}

function seed(options: {
  email: string;
  status: string;
  confirmationToken?: string;
  unsubscribeToken?: string;
  confirmedAt?: string | null;
  unsubscribedAt?: string | null;
}): void {
  run(
    'INSERT INTO subscribers',
    `
    INSERT INTO subscribers (
      email, email_normalized, status, source, source_detail,
      consent_provenance, confirmed_at, unsubscribed_at,
      confirmation_token_hash, unsubscribe_token_hash,
      acquisition_source, acquisition_detail, utm_campaign,
      created_at, updated_at
    ) VALUES (
      ${literal(options.email.toLowerCase())}, ${literal(options.email.toLowerCase())},
      ${literal(options.status)}, 'website', 'blog-inline',
      'website_double_opt_in',
      ${options.confirmedAt ? `${literal(options.confirmedAt)}::timestamptz` : 'NULL'},
      ${options.unsubscribedAt ? `${literal(options.unsubscribedAt)}::timestamptz` : 'NULL'},
      ${options.confirmationToken ? literal(hashToken(options.confirmationToken)) : 'NULL'},
      ${literal(hashToken(options.unsubscribeToken ?? 'unused-token'))},
      'x', 'launch-2026', 'launch',
      '2026-01-01T00:00:00.000Z'::timestamptz,
      '2026-01-01T00:00:00.000Z'::timestamptz
    )`,
  );

  const row = subscriberRow(options.email);
  assert.equal(row.acquisition_source, 'x', 'seed attribution is in place');
}

sql(`CREATE SCHEMA ${schema}`);
try {
  for (const file of [
    '001_initial.sql',
    '002_event_and_campaign_state.sql',
    '003_production_send_safety.sql',
    '004_acquisition_attribution.sql',
  ])
    sql(
      readFileSync(
        new URL(`../migrations/newsletter/${file}`, import.meta.url),
        'utf8',
      ),
    );

  const originalEnv = { ...process.env };
  // Confirmation delivery stays off: this harness must never reach SES.
  delete process.env.NEWSLETTER_CONFIRMATION_DELIVERY_ENABLED;
  delete process.env.NEWSLETTER_CONFIRMATION_PRODUCTION_ENABLED;

  // A bounce or a complaint is a deliverability fact, so a signup request can
  // never reopen one, and an active subscriber is never rewritten either.
  for (const status of ['active', 'bounced', 'complained']) {
    const email = `${status}@example.com`;
    seed({
      email,
      status,
      confirmedAt: '2026-01-02T00:00:00.000Z',
    });
    const before = subscriberRow(email);
    await requestSubscription({ email }, db);
    const after = subscriberRow(email);
    assert.deepEqual(
      after,
      before,
      `${status} must be untouched by a signup request`,
    );
  }

  // An unsubscribe is a preference: the request issues a fresh token and leaves
  // everything else — status, attribution, and the recorded cancellation — as it
  // was, so the row stays suppressed until the reader confirms.
  const returning = 'returning@example.com';
  seed({
    email: returning,
    status: 'unsubscribed',
    confirmedAt: '2026-01-02T00:00:00.000Z',
    unsubscribedAt: '2026-02-01T00:00:00.000Z',
  });
  const beforeReturn = subscriberRow(returning);
  assert.equal(beforeReturn.confirmation_token_hash, null);
  await requestSubscription({ email: returning }, db);
  const afterReturn = subscriberRow(returning);
  assert.equal(afterReturn.status, 'unsubscribed');
  assert.match(
    afterReturn.confirmation_token_hash ?? '',
    /^[0-9a-f]{64}$/,
    'the request issues a hashed confirmation token',
  );
  assert.notEqual(
    afterReturn.confirmation_token_hash,
    beforeReturn.confirmation_token_hash,
  );
  // The request half of a resubscription is provable here; the raw token is
  // delivered by email only, so the confirmation half is proven below with a
  // known token on the same unsubscribed status.
  const { confirmation_token_hash: issued, ...unchanged } = afterReturn;
  const { confirmation_token_hash: previous, ...expected } = beforeReturn;
  assert.equal(issued === null, false);
  assert.equal(previous, null);
  assert.deepEqual(
    { ...unchanged, updated_at: expected.updated_at },
    expected,
    'a resubscription request changes nothing but the token',
  );
  assert.ok(
    new Date(afterReturn.updated_at).getTime() >=
      new Date(beforeReturn.updated_at).getTime(),
  );
  assert.equal(
    await confirmSubscription('never-issued', db),
    false,
    'only an issued token can confirm',
  );
  seed({
    email: 'pending@example.com',
    status: 'pending',
    confirmationToken: 'pending-token',
  });
  assert.equal(await confirmSubscription('pending-token', db), true);
  assert.equal(
    await confirmSubscription('pending-token', db),
    false,
    'a confirmation token works once',
  );
  const confirmed = subscriberRow('pending@example.com');
  assert.equal(confirmed.status, 'active');
  assert.equal(confirmed.confirmation_token_hash, null);
  assert.ok(confirmed.confirmed_at, 'confirmation records when it happened');

  seed({
    email: 'returned@example.com',
    status: 'unsubscribed',
    confirmationToken: 'return-token',
    confirmedAt: '2026-01-02T00:00:00.000Z',
    unsubscribedAt: '2026-02-01T00:00:00.000Z',
  });
  assert.equal(await confirmSubscription('return-token', db), true);
  assert.equal(
    await confirmSubscription('return-token', db),
    false,
    'the returned token is single use too',
  );
  const returned = subscriberRow('returned@example.com');
  assert.equal(returned.status, 'active');
  assert.equal(
    new Date(returned.confirmed_at!).toISOString(),
    '2026-01-02T00:00:00.000Z',
    'a return keeps the first confirmation date',
  );
  assert.equal(
    new Date(returned.unsubscribed_at!).toISOString(),
    '2026-02-01T00:00:00.000Z',
    'the last cancellation stays on the row',
  );
  assert.equal(returned.acquisition_source, 'x');

  // A confirmation link cannot reopen a hard bounce: that is suppressed state,
  // not a preference.
  seed({
    email: 'bounced-stale@example.com',
    status: 'bounced',
    confirmationToken: 'stale-token',
    confirmedAt: '2026-01-02T00:00:00.000Z',
  });
  assert.equal(await confirmSubscription('stale-token', db), false);
  assert.equal(subscriberRow('bounced-stale@example.com').status, 'bounced');

  // A cancellation invalidates a token that was issued but never clicked, and it
  // does so for a row that is already suppressed: the reader's unsubscribe click
  // is the later instruction, so the confirmation email sitting in their inbox
  // must stop working.
  seed({
    email: 'cancel-stale@example.com',
    status: 'unsubscribed',
    confirmationToken: 'outstanding-token',
    unsubscribeToken: 'cancel-stale-token',
    unsubscribedAt: '2026-02-01T00:00:00.000Z',
  });
  assert.equal(await unsubscribe('cancel-stale-token', db), true);
  const cancelled = subscriberRow('cancel-stale@example.com');
  assert.equal(
    cancelled.confirmation_token_hash,
    null,
    'a cancellation clears an outstanding confirmation token',
  );
  assert.equal(
    new Date(cancelled.unsubscribed_at!).toISOString(),
    '2026-02-01T00:00:00.000Z',
    'clearing the token does not restate the cancellation time',
  );
  assert.equal(
    await confirmSubscription('outstanding-token', db),
    false,
    'a cancelled row cannot be reopened by the confirmation email it was sent',
  );

  // Cancelling after a return records the new cancellation, while a repeat click
  // on an already unsubscribed row is a no-op.
  seed({
    email: 'cancel@example.com',
    status: 'active',
    unsubscribeToken: 'cancel-token',
    confirmedAt: '2026-01-02T00:00:00.000Z',
  });
  assert.equal(await unsubscribe('cancel-token', db), true);
  const firstCancel = subscriberRow('cancel@example.com');
  assert.equal(firstCancel.status, 'unsubscribed');
  assert.ok(firstCancel.unsubscribed_at);
  assert.equal(await unsubscribe('cancel-token', db), true);
  const repeatCancel = subscriberRow('cancel@example.com');
  assert.equal(
    repeatCancel.unsubscribed_at,
    firstCancel.unsubscribed_at,
    'an already unsubscribed row is not rewritten',
  );
  run(
    'UPDATE subscribers',
    `UPDATE subscribers SET status = 'active' WHERE email_normalized = ${literal('cancel@example.com')}`,
  );
  assert.equal(await unsubscribe('cancel-token', db), true);
  const secondCancel = subscriberRow('cancel@example.com');
  assert.ok(
    new Date(secondCancel.unsubscribed_at!).getTime() >
      new Date(firstCancel.unsubscribed_at!).getTime(),
    'the cancellation that just happened is the one recorded',
  );

  process.env = originalEnv;
  console.log('✅ Subscriber lifecycle SQL behaves as documented');
} finally {
  sql(`DROP SCHEMA ${schema} CASCADE`);
}
