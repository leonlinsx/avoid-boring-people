// Disposable local Postgres only. Never reads DATABASE_URL or calls SES.
// NEWSLETTER_TEST_PG_SOCKET=/tmp/newsletter-lifecycle-pg-<id>
// PGUSER=<local user> node --import ./tests/register-loaders.mjs --loader ts-node/esm tests/newsletter-import-postgres.ts
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import type { NeonDb } from '../src/lib/neon.ts';
import {
  applySubstackImport,
  preflightSubstackImport,
} from '../src/lib/newsletter/import-store.ts';

import {
  importFixture,
  approvalFor,
  planFor,
} from './suites/newsletter-import.ts';

const socket = process.env.NEWSLETTER_TEST_PG_SOCKET;
assert.match(socket ?? '', /^\/tmp\/newsletter-lifecycle-pg-[A-Za-z0-9]+$/);
const schema = 'newsletter_import_test';
const env = {
  PATH: process.env.PATH,
  PGUSER: process.env.PGUSER,
  PGOPTIONS: `-c search_path=${schema},public -c timezone=UTC`,
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
      '-qAt',
    ],
    { input: query, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], env },
  ).trim();
}
function literal(value: unknown): string {
  if (value === null) return 'NULL';
  return `'${String(value).replaceAll("'", "''")}'`;
}
type Query = { statement: string; template: string };
function query(parts: TemplateStringsArray, ...values: unknown[]): Query {
  return {
    template: parts.join(''),
    statement: parts.reduce(
      (s, p, i) => s + p + (i < values.length ? literal(values[i]) : ''),
      '',
    ),
  };
}
function returning(q: Query): string {
  if (/^(SET|LOCK)/.test(q.template.trim())) return q.statement + ';';
  if (/^INSERT/.test(q.template.trim()) || /^UPDATE/.test(q.template.trim()))
    return `WITH modified AS (${q.statement}) SELECT COALESCE(jsonb_agg(modified), '[]') FROM modified;`;
  return `SELECT COALESCE(jsonb_agg(result), '[]') FROM (${q.statement}) result;`;
}
let failAfterWrites = false;
let loseAcknowledgment = false;
const db = Object.assign(
  (parts: TemplateStringsArray, ...values: unknown[]) => {
    const q = query(parts, ...values);
    return Object.assign(q, {
      then(
        resolve: (value: unknown) => void,
        reject: (error: unknown) => void,
      ) {
        try {
          resolve(JSON.parse(sql(returning(q))));
        } catch (error) {
          reject(error);
        }
      },
    });
  },
  {
    transaction: async (
      queries: Query[],
      options: { readOnly?: boolean; isolationLevel?: string },
    ) => {
      for (const q of queries)
        assert.equal(
          q.statement.includes('cancel@example.test'),
          false,
          'cancelled addresses must never be sent to Postgres',
        );
      const statements = queries.map(returning).join('\n');
      const out = sql(
        `BEGIN ISOLATION LEVEL READ COMMITTED ${options.readOnly ? 'READ ONLY' : 'READ WRITE'};\n${statements}\n${failAfterWrites ? 'SELECT 1/0;' : ''}\nCOMMIT;`,
      );
      if (loseAcknowledgment)
        throw new Error('Synthetic lost acknowledgment after commit');
      const parsed = out
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line));
      // SET/LOCK return no rowsets; Neon returns an empty array for each.
      let i = 0;
      return queries.map((q) =>
        /^(SET|LOCK)/.test(q.template.trim()) ? [] : parsed[i++],
      );
    },
  },
) as unknown as NeonDb;
const plan = planFor(importFixture);
const secret = 'synthetic-unsubscribe-secret-'.repeat(2);
function rows() {
  return JSON.parse(
    sql(
      "SELECT COALESCE(jsonb_agg(s ORDER BY email_normalized),'[]') FROM subscribers s",
    ),
  ) as any[];
}
function row(email: string) {
  return rows().find((s) => s.email_normalized === email);
}
function clear() {
  sql('TRUNCATE subscribers CASCADE;');
}
function seed(status: string, email = 'free@example.test') {
  sql(
    `INSERT INTO subscribers(email,email_normalized,status,source,consent_provenance,unsubscribe_token_hash,confirmation_token_hash,confirmation_expires_at) VALUES(${literal(email)},${literal(email)},${literal(status)},'website','website_double_opt_in','synthetic-unsubscribe','synthetic-confirm',now()+interval '1 day')`,
  );
}

sql(`CREATE SCHEMA ${schema}`);
try {
  for (const file of [
    '001_initial.sql',
    '002_event_and_campaign_state.sql',
    '003_production_send_safety.sql',
    '004_acquisition_attribution.sql',
    '005_pre_migration_readiness.sql',
  ])
    sql(
      readFileSync(
        new URL(`../migrations/newsletter/${file}`, import.meta.url),
        'utf8',
      ),
    );
  let preflight = await preflightSubstackImport(db, plan);
  assert.equal(preflight.newActive, 5);
  assert.equal(preflight.predictedTotalSubscribers, 5);
  assert.equal(preflight.predictedTotalActive, 5);
  assert.equal(preflight.predictedTotalSuppressed, 0);
  assert.equal(preflight.existingCampaigns, 0);
  assert.equal(preflight.existingCampaignRecipients, 0);
  assert.equal(preflight.newSuppressed, 0);
  assert.equal(preflight.unexpectedCollisions, 0);
  assert.equal(
    (await applySubstackImport(db, plan, approvalFor(plan), secret))
      .affectedRows,
    5,
  );
  assert.equal(rows().length, 5);
  for (const email of ['free', 'paid', 'monthly', 'comp', 'gift'])
    assert.equal(row(`${email}@example.test`).status, 'active');
  assert.equal(
    row('free@example.test').original_subscribed_at,
    '2020-02-01T00:00:00+00:00',
  );
  assert.equal(
    row('cancel@example.test'),
    undefined,
    'cancelled address must never be inserted',
  );
  const metadata = JSON.parse(row('paid@example.test').source_detail);
  assert.equal(metadata.subscriptionSourceFree, 'subscription-transfer');
  assert.equal(metadata.expirationDate, 'Paused');
  assert.equal(metadata.rosterFingerprint, plan.rosterFingerprint);
  const before = rows();
  await assert.rejects(() =>
    applySubstackImport(
      db,
      plan,
      { ...approvalFor(plan), rosterFingerprint: '0'.repeat(64) },
      secret,
    ),
  );
  assert.deepEqual(
    rows(),
    before,
    'unapproved roster fails before any mutation',
  );
  assert.equal(
    (await applySubstackImport(db, plan, approvalFor(plan), secret))
      .affectedRows,
    0,
  );
  assert.deepEqual(
    rows(),
    before,
    'exact retry must not rewrite dates, consent, tokens or attribution',
  );
  preflight = await preflightSubstackImport(db, plan);
  assert.equal(preflight.resumableRows, 5);
  assert.equal(preflight.newActive, 0);

  for (const status of ['unsubscribed', 'bounced', 'complained']) {
    sql(
      `UPDATE subscribers SET status=${literal(status)}, unsubscribed_at='2026-01-01' WHERE email_normalized='free@example.test'`,
    );
    const beforeOptOut = row('free@example.test');
    await applySubstackImport(db, plan, approvalFor(plan), secret);
    assert.deepEqual(
      row('free@example.test'),
      beforeOptOut,
      'later suppression survives retry exactly',
    );
    assert.equal(
      (await preflightSubstackImport(db, plan)).predictedRosterActive,
      4,
    );
  }
  // Cancellation addresses never enter the SQL payload. Even a pre-existing
  // cancelled-address row (with stale confirmation credentials) is untouched.
  for (const status of [
    'pending',
    'active',
    'unsubscribed',
    'bounced',
    'complained',
  ]) {
    clear();
    seed(status, 'cancel@example.test');
    const cancelled = row('cancel@example.test');
    assert.equal((await preflightSubstackImport(db, plan)).collisions, 0);
    await applySubstackImport(db, plan, approvalFor(plan), secret);
    assert.deepEqual(
      row('cancel@example.test'),
      cancelled,
      'zero cancelled-address updates, including credentials',
    );
    assert.equal(rows().length, 6);
    await applySubstackImport(db, plan, approvalFor(plan), secret);
    assert.deepEqual(row('cancel@example.test'), cancelled);
  }
  clear();
  const revived = planFor(importFixture.replace('2024-01-01', ''));
  assert.equal(revived.summary.cancellationEvidenceConflicts, 1);
  await assert.rejects(() =>
    applySubstackImport(db, revived, approvalFor(revived), secret),
  );
  assert.equal(
    rows().length,
    0,
    'retained cancellation evidence refuses an entire future file',
  );
  // Fail closed on every non-import collision, including a pending reader.
  for (const status of [
    'pending',
    'active',
    'unsubscribed',
    'bounced',
    'complained',
  ]) {
    clear();
    seed(status);
    const original = rows();
    assert.equal(
      (await preflightSubstackImport(db, plan)).unexpectedCollisions,
      1,
    );
    await assert.rejects(() =>
      applySubstackImport(db, plan, approvalFor(plan), secret),
    );
    assert.deepEqual(rows(), original);
  }
  // A collision arriving after the SELECT-only preflight is rejected inside
  // the write transaction; no other rows are imported.
  clear();
  assert.equal(
    (await preflightSubstackImport(db, plan)).unexpectedCollisions,
    0,
  );
  seed('pending');
  await assert.rejects(() =>
    applySubstackImport(db, plan, approvalFor(plan), secret),
  );
  assert.equal(rows().length, 1);
  // A pending row is rejected even if its import identity marker is intact.
  clear();
  await applySubstackImport(db, plan, approvalFor(plan), secret);
  sql(
    "UPDATE subscribers SET status='pending', confirmation_token_hash='pending-token' WHERE email_normalized='free@example.test'",
  );
  const pending = rows();
  await assert.rejects(() =>
    applySubstackImport(db, plan, approvalFor(plan), secret),
  );
  assert.deepEqual(rows(), pending);

  // A failure after the INSERT rolls back all rows, including more than one
  // former 100-row batch. Retrying the exact file imports each address once.
  clear();
  const large = planFor(
    'Email,Type,Start date,Cancel date\n' +
      Array.from(
        { length: 205 },
        (_, i) => `reader${i}@example.test,Free,2020-01-01,`,
      ).join('\n'),
  );
  failAfterWrites = true;
  await assert.rejects(() =>
    applySubstackImport(db, large, approvalFor(large), secret),
  );
  assert.equal(rows().length, 0);
  failAfterWrites = false;
  await applySubstackImport(db, large, approvalFor(large), secret);
  assert.equal(rows().length, 205);
  assert.equal(
    (await applySubstackImport(db, large, approvalFor(large), secret))
      .affectedRows,
    0,
  );

  // Unknown commit outcome: a successful transaction followed by a lost reply
  // is also safe to reconcile and retry, including an opt-out in between.
  clear();
  loseAcknowledgment = true;
  await assert.rejects(() =>
    applySubstackImport(db, plan, approvalFor(plan), secret),
  );
  loseAcknowledgment = false;
  assert.equal(rows().length, 5);
  sql(
    "UPDATE subscribers SET status='unsubscribed', unsubscribed_at=now() WHERE email_normalized='free@example.test'",
  );
  const optedOut = rows();
  assert.equal(
    (await applySubstackImport(db, plan, approvalFor(plan), secret))
      .affectedRows,
    0,
  );
  assert.deepEqual(rows(), optedOut);
  const otherFile = planFor(importFixture.replace('2020-02-01', '2020-02-02'));
  await assert.rejects(() =>
    applySubstackImport(db, otherFile, approvalFor(otherFile), secret),
  );
  assert.deepEqual(
    rows(),
    optedOut,
    'different export must not rewrite original import metadata',
  );
  assert.equal(sql('SELECT count(*) FROM campaigns'), '0');
  assert.equal(sql('SELECT count(*) FROM campaign_recipients'), '0');
  console.log(
    'Substack importer disposable Postgres checks passed: atomic rollback, lost acknowledgment, collision rejection, retry identity, cancellation exclusion and retained evidence, historical dates and later opt-outs. No email sent.',
  );
} finally {
  sql(`DROP SCHEMA ${schema} CASCADE`);
}
