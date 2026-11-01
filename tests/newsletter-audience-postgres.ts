// Real preview + snapshot behavior against disposable Postgres — both schema variants.
// Tests that previewAudience() never references 008 columns when absent, that
// activeSuppressed is correctly excluded from eligibility, and that segments are
// mutually exclusive and sum to total with active == COUNT(*) WHERE status='active'.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import type { NeonDb } from '../src/lib/neon.ts';
import { snapshotCampaign } from '../src/lib/newsletter/campaign.ts';
import { previewAudience } from '../src/lib/newsletter/audience.ts';

const root = mkdtempSync('/tmp/newsletter-audience-pg-');
const bin = process.env.NEWSLETTER_TEST_PG_BIN ?? '/usr/lib/postgresql/16/bin';
const env = {
  PATH: process.env.PATH,
  PGHOST: root,
  PGPORT: '55440',
  PGDATABASE: 'postgres',
  PGUSER: process.env.USER,
  PGOPTIONS: '-c timezone=UTC',
};
const pg = (name: string, args: string[]) =>
  execFileSync(`${bin}/${name}`, args, {
    env,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
const sql = (query: string) =>
  execFileSync('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-At'], {
    input: query,
    env,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
const literal = (value: unknown): string => {
  if (value == null) return 'NULL';
  if (Array.isArray(value))
    return `ARRAY[${value.map(literal).join(',')}]::text[]`;
  return `'${String(value).replaceAll("'", "''")}'`;
};
const db = (async (parts: TemplateStringsArray, ...values: unknown[]) => {
  const query = parts.reduce(
    (text, part, i) =>
      text + part + (i < values.length ? literal(values[i]) : ''),
    '',
  );
  let wrapped: string;
  if (/^\s*WITH/i.test(query)) {
    const markers = [
      ...query.matchAll(
        /\n\s*(SELECT new_campaign\.\*|UPDATE campaign_recipients SET status = 'sending'|UPDATE campaigns SET batch_accepted|SELECT count\(\*\)::int AS count FROM suppressed)/g,
      ),
    ];
    const last = markers.at(-1);
    if (!last) {
      // Non-snapshot WITH (e.g. event ingestion) — still has RETURNING or is void.
      // Fall back to generic handling: if it returns rows, wrap as modified, else exec.
      if (/\bRETURNING\b/i.test(query)) {
        wrapped = `WITH modified AS (${query}) SELECT COALESCE(json_agg(row_to_json(modified)), '[]'::json) FROM modified`;
        return JSON.parse(sql(wrapped));
      }
      sql(query);
      return [];
    }
    const index = last.index!;
    wrapped = `${query.slice(0, index)}, result AS (${query.slice(index)}) SELECT COALESCE(json_agg(result), '[]'::json) FROM result`;
  } else if (/\bRETURNING\b/i.test(query)) {
    wrapped = `WITH result AS (${query}) SELECT COALESCE(json_agg(result), '[]'::json) FROM result`;
  } else if (/^\s*SELECT/i.test(query)) {
    wrapped = `SELECT COALESCE(json_agg(result), '[]'::json) FROM (${query}) result`;
  } else {
    sql(query);
    return [];
  }
  return JSON.parse(sql(wrapped));
}) as unknown as NeonDb;

function seedActiveSuppressedTestData() {
  sql(
    'TRUNCATE subscribers, campaign_recipients, campaigns, newsletter_event_receipts CASCADE',
  );
  // defaultEligible: active + confirmed
  sql(
    `INSERT INTO subscribers (email,email_normalized,status,source,unsubscribe_token_hash,consent_provenance,confirmed_at) VALUES ('eligible1@example.com','eligible1@example.com','active','manual','t1','synthetic','2026-01-01')`,
  );
  sql(
    `INSERT INTO subscribers (email,email_normalized,status,source,unsubscribe_token_hash,consent_provenance,confirmed_at) VALUES ('eligible2@example.com','eligible2@example.com','active','manual','t2','synthetic','2026-01-01')`,
  );
  // eligible via delivered_at (not confirmed) - need a campaign + recipient with delivered_at
  sql(
    `INSERT INTO subscribers (email,email_normalized,status,source,unsubscribe_token_hash,consent_provenance) VALUES ('eligible3@example.com','eligible3@example.com','active','manual','t3','synthetic')`,
  );
  sql(
    `INSERT INTO campaigns (id, article_slug, subject, status) VALUES ('00000000-0000-0000-0000-000000000001','_probe_delivery','probe','completed') ON CONFLICT DO NOTHING`,
  );
  sql(
    `INSERT INTO campaign_recipients (campaign_id, subscriber_id, status, delivered_at, subscribed_at_snapshot) SELECT c.id, s.id, 'sent', now(), now() FROM campaigns c, subscribers s WHERE c.article_slug='_probe_delivery' AND s.email_normalized='eligible3@example.com' ON CONFLICT DO NOTHING`,
  );
  // activeUnverified
  sql(
    `INSERT INTO subscribers (email,email_normalized,status,source,unsubscribe_token_hash,consent_provenance) VALUES ('unverified@example.com','unverified@example.com','active','manual','t4','synthetic')`,
  );
  // activeSuppressed via hard_bounced_at
  if (columnExists('hard_bounced_at')) {
    sql(
      `INSERT INTO subscribers (email,email_normalized,status,source,unsubscribe_token_hash,consent_provenance,confirmed_at,hard_bounced_at) VALUES ('suppressed1@example.com','suppressed1@example.com','active','manual','t5','synthetic','2026-01-01', now())`,
    );
    sql(
      `INSERT INTO subscribers (email,email_normalized,status,source,unsubscribe_token_hash,consent_provenance,complained_at) VALUES ('suppressed2@example.com','suppressed2@example.com','active','manual','t6','synthetic', now())`,
    );
  }
  // other buckets
  sql(
    `INSERT INTO subscribers (email,email_normalized,status,source,unsubscribe_token_hash,consent_provenance,confirmation_token_hash,confirmation_expires_at) VALUES ('pending@example.com','pending@example.com','pending','manual','t7','synthetic','pendhash', now() + interval '1 day')`,
  );
  sql(
    `INSERT INTO subscribers (email,email_normalized,status,source,unsubscribe_token_hash,consent_provenance) VALUES ('unsub@example.com','unsub@example.com','unsubscribed','manual','t8','synthetic')`,
  );
  sql(
    `INSERT INTO subscribers (email,email_normalized,status,source,unsubscribe_token_hash,consent_provenance,confirmed_at) VALUES ('compl@example.com','compl@example.com','complained','manual','t9','synthetic','2026-01-01')`,
  );
  // bounced with subtypes (if 007 exists)
  if (columnExists('bounce_subtype', 'campaign_recipients')) {
    sql(
      `INSERT INTO subscribers (email,email_normalized,status,source,unsubscribe_token_hash,consent_provenance) VALUES ('bounced1@example.com','bounced1@example.com','bounced','manual','t10','synthetic')`,
    );
    sql(
      `INSERT INTO campaign_recipients (campaign_id, subscriber_id, status, bounce_type, bounce_subtype, subscribed_at_snapshot) SELECT c.id, s.id, 'bounced', 'Permanent', 'General', now() FROM campaigns c, subscribers s WHERE c.article_slug='_probe_delivery' AND s.email_normalized='bounced1@example.com' ON CONFLICT DO NOTHING`,
    );
  } else {
    sql(
      `INSERT INTO subscribers (email,email_normalized,status,source,unsubscribe_token_hash,consent_provenance) VALUES ('bounced1@example.com','bounced1@example.com','bounced','manual','t10','synthetic')`,
    );
  }
}

function columnExists(col: string, table = 'subscribers'): boolean {
  const res = sql(
    `SELECT count(*) FROM information_schema.columns WHERE table_name='${table}' AND column_name='${col}'`,
  );
  return res !== '0';
}

async function verifyPreviewInvariants(label: string) {
  const preview = await previewAudience(db);
  // No throw = never referenced missing column
  const sum =
    preview.defaultEligible +
    preview.activeUnverified +
    preview.activeSuppressed +
    preview.hardBounces +
    preview.unknownBounces +
    preview.validationSuppressed +
    preview.otherSuppressions +
    preview.complained +
    preview.unsubscribed +
    preview.pending;
  assert.equal(
    sum,
    preview.total,
    `${label}: segments must sum to total: ${sum} != ${preview.total} (eligible=${preview.defaultEligible} unverified=${preview.activeUnverified} suppressed=${preview.activeSuppressed} hard=${preview.hardBounces} unknown=${preview.unknownBounces} validation=${preview.validationSuppressed} other=${preview.otherSuppressions} complained=${preview.complained} unsubscribed=${preview.unsubscribed} pending=${preview.pending})`,
  );
  const actualActive = Number(
    sql(`SELECT count(*) FROM subscribers WHERE status='active'`),
  );
  assert.equal(
    preview.active,
    actualActive,
    `${label}: active must equal COUNT(*) WHERE status='active': ${preview.active} != ${actualActive}`,
  );
  // activeSuppressed must be 0 when 008 absent
  if (!columnExists('hard_bounced_at')) {
    assert.equal(
      preview.activeSuppressed,
      0,
      `${label}: activeSuppressed must be 0 when 008 absent`,
    );
    assert.equal(preview.deliverySuppressionAvailable, false);
  } else {
    assert.equal(preview.deliverySuppressionAvailable, true);
  }
  console.log(
    `PASS ${label}: sum=${sum} total=${preview.total} active=${preview.active} activeSuppressed=${preview.activeSuppressed}`,
  );
  return preview;
}

let started = false;
const originalEnv = { ...process.env };
try {
  pg('initdb', ['-D', `${root}/data`, '-A', 'trust', '--no-locale']);
  pg('pg_ctl', [
    '-D',
    `${root}/data`,
    '-l',
    `${root}/server.log`,
    '-o',
    `-F -k ${root} -p 55440 -c listen_addresses=''`,
    '-w',
    'start',
  ]);
  started = true;

  // Phase 1: without 007/008 (only 001-006)
  for (const file of [
    '001_initial.sql',
    '002_event_and_campaign_state.sql',
    '003_production_send_safety.sql',
    '004_acquisition_attribution.sql',
    '005_pre_migration_readiness.sql',
    '006_phased_delivery.sql',
  ])
    sql(
      readFileSync(
        new URL(`../migrations/newsletter/${file}`, import.meta.url),
        'utf8',
      ),
    );
  console.log('Schema 006: applied 001-006 (no 007/008)');

  seedActiveSuppressedTestData();
  await verifyPreviewInvariants('006-only (no 007/008)');

  // snapshotCampaign must fail closed without 008
  delete process.env.NEWSLETTER_ALLOW_MISSING_SUPPRESSION;
  const hash = 'a'.repeat(64);
  const md = '---\ntitle: Test\n---\n\nBody';
  // Need at least one eligible row for snapshot attempt; currently we have eligible rows
  const eligibleCount = Number(
    sql(
      `SELECT count(*) FROM subscribers WHERE status='active' AND confirmed_at IS NOT NULL`,
    ),
  );
  await assert.rejects(
    () =>
      snapshotCampaign(
        {
          articleId: '2026_01_01_test_a/index.md',
          markdown: md,
          subject: 'Test',
          contentHash: hash,
          expected: eligibleCount,
          maximum: 10000,
          cohortSize: null,
        },
        db,
      ),
    /008_delivery_suppression/,
    'snapshot must fail closed without 008',
  );
  console.log(
    'PASS 006-only: snapshotCampaign fail-closed without 008 (no env escape)',
  );

  // With escape, synthetic harness verifies legacy path still works (checked via delivery harness).
  // Cleanup for next phase
  sql('TRUNCATE campaigns, campaign_recipients CASCADE');

  // Phase 2: with 007+008
  for (const file of [
    '007_bounce_classification.sql',
    '008_delivery_suppression.sql',
  ])
    sql(
      readFileSync(
        new URL(`../migrations/newsletter/${file}`, import.meta.url),
        'utf8',
      ),
    );
  console.log('Schema 008: applied 007+008');

  seedActiveSuppressedTestData();
  const preview008 = await verifyPreviewInvariants('006+007+008');
  assert.equal(
    preview008.activeSuppressed,
    2,
    'with 008, activeSuppressed should be 2',
  );
  assert.equal(
    preview008.defaultEligible,
    3,
    'with 008, defaultEligible should be 3 (suppressed excluded)',
  );
  assert.equal(
    preview008.activeUnverified,
    1,
    'with 008, activeUnverified should be 1',
  );

  // snapshotCampaign should now succeed without escape and exclude suppressed
  const snapWithSup = await snapshotCampaign(
    {
      articleId: '2026_01_01_test_b/index.md',
      markdown: md,
      subject: 'Test',
      contentHash: hash,
      expected: preview008.defaultEligible,
      maximum: 10000,
      cohortSize: null,
    },
    db,
  );
  assert.ok(snapWithSup.id);
  assert.equal(snapWithSup.recipient_count, preview008.defaultEligible);
  // Verify suppressed addresses are NOT in campaign_recipients
  const suppressedInCampaign = Number(
    sql(
      `SELECT count(*) FROM campaign_recipients WHERE campaign_id='${snapWithSup.id}' AND subscriber_id IN (SELECT id FROM subscribers WHERE email_normalized IN ('suppressed1@example.com','suppressed2@example.com'))`,
    ),
  );
  assert.equal(
    suppressedInCampaign,
    0,
    'suppressed active must be excluded from campaign snapshot',
  );
  console.log(
    'PASS 006+007+008: snapshotCampaign excludes activeSuppressed and succeeds without escape',
  );

  console.log(
    'PASS newsletter-audience-postgres: both schema variants (006-only and 006+007+008) + fail-closed verified',
  );
} finally {
  process.env = originalEnv;
  if (started)
    pg('pg_ctl', ['-D', `${root}/data`, '-m', 'immediate', '-w', 'stop']);
  rmSync(root, { recursive: true, force: true });
}
