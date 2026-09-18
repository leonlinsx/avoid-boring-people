// Opt-in integration test for the newsletter analytics SQL against a
// disposable local Postgres cluster only. NEWSLETTER_TEST_PG_SOCKET must be a
// private /tmp directory; this never uses DATABASE_URL.
//
//   export PATH=$PATH:/usr/lib/postgresql/16/bin
//   NEWSLETTER_TEST_PG_SOCKET=/tmp/newsletter-analytics-pg-test \
//     node --import ts-node/esm tests/newsletter-analytics-postgres.ts
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { collectNewsletterMetrics } from '../src/lib/newsletter/analytics.ts';
import type { newsletterDb } from '../src/lib/newsletter/db.ts';

const socket = process.env.NEWSLETTER_TEST_PG_SOCKET;
assert.match(socket ?? '', /^\/tmp\/newsletter-analytics-pg-[A-Za-z0-9]+$/);
const schema = 'newsletter_analytics_test';
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
// The analytics module only issues SELECT statements, so every query is wrapped
// in json_agg to return real rows with the column names the module expects.
const db = (async (parts: TemplateStringsArray, ...values: unknown[]) => {
  const query = parts.reduce(
    (text, part, index) =>
      text + part + (index < values.length ? literal(values[index]) : ''),
    '',
  );
  const json = sql(
    `SELECT COALESCE(json_agg(row_to_json(rows)), '[]'::json) FROM (${query}) rows`,
  );
  return JSON.parse(json) as unknown[];
}) as unknown as ReturnType<typeof newsletterDb>;

const now = new Date('2026-03-01T12:00:00.000Z');

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

  sql(`
    INSERT INTO subscribers (
      email, email_normalized, status, source, source_detail,
      unsubscribe_token_hash, consent_provenance, confirmed_at, created_at,
      original_subscribed_at, unsubscribed_at, imported_at,
      legacy_substack_cancel_date, confirmation_token_hash,
      acquisition_source, acquisition_detail
    ) VALUES
      -- current window, attributed
      ('x1@example.com','x1@example.com','active','website','blog-inline','t','website_double_opt_in',
        '2026-02-24T10:00:00Z','2026-02-24T10:00:00Z','2026-02-24T10:00:00Z',NULL,NULL,NULL,NULL,'x','launch-2026'),
      ('x2@example.com','x2@example.com','active','website','blog-inline','t','website_double_opt_in',
        '2026-02-25T10:00:00Z','2026-02-25T10:00:00Z','2026-02-25T10:00:00Z',NULL,NULL,NULL,NULL,'x','launch-2026'),
      -- prior window, same source and detail
      ('x3@example.com','x3@example.com','active','website','blog-inline','t','website_double_opt_in',
        '2026-02-17T10:00:00Z','2026-02-17T10:00:00Z','2026-02-17T10:00:00Z',NULL,NULL,NULL,NULL,'x','launch-2026'),
      ('reddit1@example.com','reddit1@example.com','active','website','blog-inline','t','website_double_opt_in',
        '2026-02-18T10:00:00Z','2026-02-18T10:00:00Z','2026-02-18T10:00:00Z',NULL,NULL,NULL,NULL,'reddit','r/creativecoding'),
      -- requested but never confirmed: not growth, still pending
      ('pending@example.com','pending@example.com','pending','website','blog-inline','t','website_double_opt_in',
        NULL,'2026-02-26T10:00:00Z',NULL,NULL,NULL,NULL,'abc','referral','news.ycombinator.com'),
      -- imported subscribers have no recorded acquisition channel
      ('imported@example.com','imported@example.com','active','substack_import',NULL,'t','substack_export',
        '2026-02-24T09:00:00Z','2026-02-24T09:00:00Z','2026-02-23T09:00:00Z',NULL,'2026-02-24T09:00:00Z',NULL,NULL,NULL,NULL),
      -- cancellation stamped at import time: never a real unsubscribe event
      ('imported-cancelled@example.com','imported-cancelled@example.com','unsubscribed','substack_import',NULL,'t','substack_export',
        '2024-05-01T00:00:00Z','2026-02-24T09:00:00Z','2024-05-01T00:00:00Z','2026-02-24T09:00:00Z','2026-02-24T09:00:00Z',NULL,NULL,NULL,NULL),
      -- a real Substack cancellation keeps its own date, which here falls outside both windows
      ('legacy-cancelled@example.com','legacy-cancelled@example.com','unsubscribed','substack_import',NULL,'t','substack_export',
        '2024-05-01T00:00:00Z','2026-01-01T00:00:00Z','2024-05-01T00:00:00Z','2026-01-01T00:00:00Z','2026-02-24T08:00:00Z','2026-01-01T00:00:00Z',NULL,NULL,NULL),
      ('bounced@example.com','bounced@example.com','bounced','manual','import','t','manual','2025-01-01T00:00:00Z','2025-01-01T00:00:00Z',
        '2025-01-01T00:00:00Z',NULL,NULL,NULL,NULL,NULL,NULL),
      -- unsubscribed in the current window
      ('churn@example.com','churn@example.com','unsubscribed','website','blog-inline','t','website_double_opt_in',
        '2026-01-10T10:00:00Z','2026-01-10T10:00:00Z','2026-01-10T10:00:00Z','2026-02-26T10:00:00Z',NULL,NULL,NULL,NULL,NULL),
      -- unattributed direct signup
      ('direct@example.com','direct@example.com','active','website','blog-inline','t','website_double_opt_in',
        '2026-02-27T10:00:00Z','2026-02-27T10:00:00Z','2026-02-27T10:00:00Z',NULL,NULL,NULL,NULL,NULL,NULL),
      -- activates exactly at the window start: the window is [start, now)
      ('boundary-start@example.com','boundary-start@example.com','active','website','blog-inline','t','website_double_opt_in',
        '2026-02-22T12:00:00Z','2026-02-22T12:00:00Z','2026-02-22T12:00:00Z',NULL,NULL,NULL,NULL,NULL,NULL),
      -- activates exactly at the window end, so it belongs to no window yet
      ('boundary-end@example.com','boundary-end@example.com','active','website','blog-inline','t','website_double_opt_in',
        '2026-03-01T12:00:00Z','2026-03-01T12:00:00Z','2026-03-01T12:00:00Z',NULL,NULL,NULL,NULL,'reddit','r/creativecoding');

    INSERT INTO campaigns (article_slug, subject, status)
      VALUES ('analytics-fixture','Fixture','completed');

    INSERT INTO campaign_recipients (campaign_id, subscriber_id, status, sent_at, provider_message_id)
      SELECT c.id, s.id, 'sent', '2026-02-25T12:00:00Z'::timestamptz, 'message-' || s.email
      FROM campaigns c, subscribers s
      WHERE c.article_slug = 'analytics-fixture'
        AND s.email IN ('x1@example.com','x2@example.com','x3@example.com','reddit1@example.com');

    -- Receipts carry the SES message id. Only the four receipts whose id matches
    -- a campaign recipient may reach the metrics; the confirmation-email receipt,
    -- the unmatched bounce, and the id-less event are excluded.
    INSERT INTO newsletter_event_receipts (provider, event_id, provider_message_id, event_status, event_at) VALUES
      ('ses','sent-1','message-x1@example.com','sent','2026-02-25T12:01:00Z'),
      ('ses','sent-2','message-x2@example.com','sent','2026-02-25T12:02:00Z'),
      ('ses','sent-3','message-x3@example.com','sent','2026-02-25T12:03:00Z'),
      ('ses','sent-4','message-reddit1@example.com','sent','2026-02-25T12:04:00Z'),
      ('ses','bounce-1','message-x2@example.com','bounced','2026-02-25T12:05:00Z'),
      -- confirmation email: real SES traffic, no campaign recipient
      ('ses','sent-confirmation','message-confirmation@example.com','sent','2026-02-25T12:06:00Z'),
      -- bounce for a message the campaign never recorded
      ('ses','bounce-unmatched','message-unknown@example.com','bounced','2026-02-25T12:07:00Z'),
      -- arrived before reconciliation could supply the message id
      ('ses','sent-unreconciled',NULL,'sent','2026-02-25T12:08:00Z'),
      -- outside the window, and an event still awaiting reconciliation
      ('ses','sent-old','message-x1@example.com','sent','2026-01-05T12:00:00Z'),
      ('ses','pending-1','message-x1@example.com',NULL,'2026-02-25T12:09:00Z');
  `);

  const metrics = await collectNewsletterMetrics(db, { days: 7, now });

  assert.deepEqual(metrics.audience, {
    active: 8,
    pending: 1,
    unsubscribed: 3,
    bounced: 1,
    complained: 0,
    total: 13,
  });
  assert.equal(
    metrics.growth.newSubscribers,
    5,
    'unconfirmed requests are not growth, the window start is inclusive',
  );
  assert.equal(metrics.growth.priorNewSubscribers, 2);
  assert.equal(metrics.growth.newSubscribers30, 7);
  assert.equal(
    metrics.growth.unsubscribed,
    1,
    'import-time cancellations are not events',
  );
  assert.equal(metrics.growth.netChange, 4);
  assert.equal(
    metrics.growth.unsubscribeRate,
    0.25,
    'the rate is window unsubscribes over window sends, not a cohort rate',
  );
  assert.equal(metrics.windowStart, '2026-02-22T12:00:00.000Z');

  assert.deepEqual(
    metrics.acquisition.map((entry) => ({
      source: entry.source,
      count: entry.count,
      priorCount: entry.priorCount,
    })),
    [
      { source: 'unknown', count: 2, priorCount: 0 },
      { source: 'x', count: 2, priorCount: 1 },
      { source: 'imported_substack', count: 1, priorCount: 0 },
    ],
    'prior-only sources are omitted and imports are classified',
  );
  assert.equal(
    metrics.acquisition.reduce((total, entry) => total + entry.count, 0),
    metrics.growth.newSubscribers,
    'acquisition reconciles with growth for the same window',
  );
  assert.equal(
    metrics.sharesWithheld,
    true,
    'a 5-subscriber window is too small for shares',
  );
  assert.deepEqual(metrics.acquisitionDetails, []);

  assert.deepEqual(
    {
      sends: metrics.deliverability.sends,
      deliveries: metrics.deliverability.deliveries,
      hardBounces: metrics.deliverability.hardBounces,
      complaints: metrics.deliverability.complaints,
      bounceRate: metrics.deliverability.bounceRate,
    },
    {
      sends: 4,
      deliveries: 4,
      hardBounces: 1,
      complaints: 0,
      bounceRate: 0.25,
    },
  );
  // Only receipts whose message id matches a campaign recipient are counted, so
  // the confirmation-email receipt, the unmatched bounce, and the unreconciled
  // id-less event stay out of the campaign rates.
  assert.equal(
    metrics.deliverability.deliveries,
    metrics.deliverability.sends,
    'non-campaign receipts must not inflate deliveries past sends',
  );
  assert.ok(
    !metrics.alerts.some((alert) => alert.includes('Bounce rate')),
    'four sends are too few to compare rates against SES thresholds',
  );
  assert.ok(
    metrics.notes.some((note) => note.includes('cover 4 sends')),
    'the small sample is disclosed instead',
  );
  assert.ok(
    !metrics.alerts.some((alert) => alert.includes('No campaign')),
    'campaign activity is detected',
  );
  assert.ok(
    !metrics.alerts.some((alert) => alert.includes('Unsubscribes rose')),
    'two unsubscribes are not a spike',
  );

  const monthly = await collectNewsletterMetrics(db, { days: 30, now });
  assert.equal(monthly.windowDays, 30);
  assert.equal(monthly.windowStart, '2026-01-30T12:00:00.000Z');
  assert.equal(
    monthly.growth.unsubscribed,
    1,
    'the cancellation date decides the window, not the import stamp',
  );
  assert.equal(
    monthly.growth.priorUnsubscribed,
    1,
    'the earlier cancellation falls into the prior window',
  );
  assert.ok(
    !monthly.alerts.some((alert) => alert.includes('Unsubscribes rose')),
    'alerts compare the window against the same-length prior window',
  );
  assert.ok(
    monthly.notes.every((note) => !note.includes('last 7 days')),
    'every note names the requested window length',
  );
  console.log(
    'Newsletter analytics Postgres integration checks passed (growth from confirmed rows, window boundaries, import exclusions, acquisition reconciliation, small-sample handling, deliverability thresholds).',
  );
} finally {
  sql(`DROP SCHEMA ${schema} CASCADE`);
}
