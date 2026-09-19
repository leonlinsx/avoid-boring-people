// Opt-in integration test against a disposable local Postgres cluster only.
// CONTACT_TEST_PG_SOCKET must be a private /tmp directory; never uses DATABASE_URL.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import {
  createContactSubmission,
  markContactLinCheckSynced,
  markContactNotified,
} from '../src/lib/contact/store.ts';
import type { NeonDb } from '../src/lib/neon.ts';

const socket = process.env.CONTACT_TEST_PG_SOCKET;
assert.match(socket ?? '', /^\/tmp\/contact-pg-[A-Za-z0-9]+$/);
const SCHEMA = 'contact_integration_test';

function psql(query: string): string {
  return execFileSync(
    'psql',
    [
      '-X',
      '-h',
      socket!,
      '-p',
      '55441',
      '-d',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
      '-At',
      '-c',
      query,
    ],
    {
      input: '',
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        PATH: process.env.PATH,
        PGOPTIONS: `-c search_path=${SCHEMA},public`,
      },
    },
  ).trim();
}

function literal(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number') return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}

// Tagged-template shim with the same shape as the Neon driver: it returns the
// statement's rows, so the store functions are exercised unchanged. A statement
// with no rows to return is run as-is, because it cannot be wrapped in a CTE.
const db = (async (parts: TemplateStringsArray, ...values: unknown[]) => {
  const statement = parts.reduce(
    (sql, part, index) =>
      sql + part + (index < values.length ? literal(values[index]) : ''),
    '',
  );
  if (!/\bRETURNING\b/i.test(statement)) {
    psql(statement);
    return [];
  }
  const json = psql(
    `WITH result AS (${statement}) SELECT coalesce(json_agg(row_to_json(result)), '[]'::json)::text FROM result`,
  );
  return JSON.parse(json || '[]') as unknown[];
}) as unknown as NeonDb;

const NOTE = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  message: 'First line.\nSecond line.',
  sourcePage: '/now',
};

function rejects(label: string, run: () => unknown): void {
  let threw = false;
  try {
    run();
  } catch {
    threw = true;
  }
  assert.ok(threw, `${label} must be rejected by the database`);
}

async function main() {
  psql(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
  psql(`CREATE SCHEMA ${SCHEMA}`);
  psql(
    readFileSync(
      new URL('../migrations/contact/001_initial.sql', import.meta.url),
      'utf8',
    ),
  );

  // A stored note comes back with the database's own id and timestamp, and
  // starts with neither delivery timestamp set: the row is the durable record
  // that the notification has not happened yet.
  const stored = await createContactSubmission(db, NOTE);
  assert.match(stored.id, /^[0-9a-f-]{36}$/);
  assert.equal(new Date(stored.createdAt).toISOString(), stored.createdAt);
  assert.equal(
    psql(
      `SELECT count(*) FROM contact_submissions WHERE id = ${literal(stored.id)}::uuid AND notified_at IS NULL AND lin_check_synced_at IS NULL`,
    ),
    '1',
  );
  assert.equal(
    psql(
      `SELECT name || '|' || email || '|' || source_page FROM contact_submissions WHERE id = ${literal(stored.id)}::uuid`,
    ),
    'Ada Lovelace|ada@example.com|/now',
  );
  // The message keeps its internal newline: the row is what the person wrote.
  assert.equal(
    psql(
      `SELECT message FROM contact_submissions WHERE id = ${literal(stored.id)}::uuid`,
    ),
    'First line.\nSecond line.',
  );

  // The notification is recorded first and on its own, because it is the one fact
  // that decides whether anybody is still owed anything. A handoff is optional, so
  // its absence must not make a delivered note look unfinished.
  await markContactNotified(db, stored.id);
  assert.equal(
    psql(
      `SELECT (notified_at IS NOT NULL)::text || '|' || (lin_check_synced_at IS NULL)::text FROM contact_submissions WHERE id = ${literal(stored.id)}::uuid`,
    ),
    'true|true',
  );
  // Neither marker can be rewritten once set, so a retried request cannot change
  // when a note was delivered.
  await markContactNotified(db, stored.id);
  await markContactLinCheckSynced(db, stored.id);
  assert.equal(
    psql(
      `SELECT (notified_at IS NOT NULL)::text || '|' || (lin_check_synced_at IS NOT NULL)::text FROM contact_submissions WHERE id = ${literal(stored.id)}::uuid`,
    ),
    'true|true',
  );

  const second = await createContactSubmission(db, {
    ...NOTE,
    sourcePage: 'unknown',
  });
  assert.notEqual(second.id, stored.id);
  assert.equal(
    psql(`SELECT count(*) FROM contact_submissions WHERE notified_at IS NULL`),
    '1',
  );

  // The only operator query has an index: a note whose notification never went out
  // is what a partial index can cover exactly, and a note that is merely missing a
  // handoff is not part of that set.
  assert.equal(
    psql(
      `SELECT count(*) FROM pg_indexes WHERE schemaname = ${literal(SCHEMA)} AND indexname = 'contact_submissions_unfinished_idx'`,
    ),
    '1',
  );
  assert.equal(
    psql(
      `EXPLAIN (COSTS OFF) SELECT id FROM contact_submissions WHERE notified_at IS NULL`,
    ).includes('contact_submissions_unfinished_idx'),
    true,
  );
  // Length limits are a backstop for a writer that skipped validation, and the
  // boundaries are inclusive on the side the application allows.
  rejects('empty name', () =>
    psql(
      `INSERT INTO contact_submissions (name, email, message) VALUES ('', ${literal(NOTE.email)}, 'body')`,
    ),
  );
  rejects('name length', () =>
    psql(
      `INSERT INTO contact_submissions (name, email, message) VALUES (${literal('x'.repeat(101))}, ${literal(NOTE.email)}, 'body')`,
    ),
  );
  rejects('email length', () =>
    psql(
      `INSERT INTO contact_submissions (name, email, message) VALUES ('Ada', ${literal('x'.repeat(255))}, 'body')`,
    ),
  );
  rejects('empty message', () =>
    psql(
      `INSERT INTO contact_submissions (name, email, message) VALUES ('Ada', ${literal(NOTE.email)}, '')`,
    ),
  );
  rejects('message length', () =>
    psql(
      `INSERT INTO contact_submissions (name, email, message) VALUES ('Ada', ${literal(NOTE.email)}, ${literal('x'.repeat(2001))})`,
    ),
  );
  rejects('empty source page', () =>
    psql(
      `INSERT INTO contact_submissions (name, email, message, source_page) VALUES ('Ada', ${literal(NOTE.email)}, 'body', '')`,
    ),
  );
  rejects('source page length', () =>
    psql(
      `INSERT INTO contact_submissions (name, email, message, source_page) VALUES ('Ada', ${literal(NOTE.email)}, 'body', ${literal('/' + 'x'.repeat(200))})`,
    ),
  );
  rejects('missing name', () =>
    psql(
      `INSERT INTO contact_submissions (email, message) VALUES (${literal(NOTE.email)}, 'body')`,
    ),
  );

  // The limits are inclusive where the application allows the maximum.
  psql(
    `INSERT INTO contact_submissions (name, email, message, source_page) VALUES (${literal('x'.repeat(100))}, ${literal('x'.repeat(254))}, ${literal('x'.repeat(2000))}, ${literal('/' + 'x'.repeat(199))})`,
  );

  // One table, no relationship columns: nothing here can store an IP address or
  // link a note to a subscriber, a comment, or anything else.
  assert.equal(
    psql(
      `SELECT string_agg(column_name, ',' ORDER BY ordinal_position) FROM information_schema.columns WHERE table_schema = ${literal(SCHEMA)} AND table_name = 'contact_submissions'`,
    ),
    'id,name,email,message,source_page,created_at,notified_at,lin_check_synced_at',
  );
  assert.equal(
    psql(
      `SELECT count(*) FROM information_schema.columns WHERE table_schema = ${literal(SCHEMA)} AND table_name = 'contact_submissions' AND (column_name ILIKE '%ip%' OR column_name ILIKE '%token%' OR column_name ILIKE '%agent%')`,
    ),
    '0',
  );

  // Re-running the migration is a no-op rather than an error.
  psql(
    readFileSync(
      new URL('../migrations/contact/001_initial.sql', import.meta.url),
      'utf8',
    ),
  );
  assert.equal(psql(`SELECT count(*) FROM contact_submissions`), '3');

  console.log(
    'Contact Postgres integration checks passed (insert, unfinished index, delivery update with and without handoff, inclusive limits, constraint rejects, idempotent migration).',
  );
}

try {
  await main();
} finally {
  psql(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
}
