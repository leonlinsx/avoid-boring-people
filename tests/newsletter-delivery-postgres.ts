// Real campaign SQL, synthetic subscribers, fake SES. Starts a disposable local
// Unix-socket-only Postgres; never reads DATABASE_URL or AWS credentials.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import type { NeonDb } from '../src/lib/neon.ts';
import {
  snapshotCampaign,
  campaignContentHash,
} from '../src/lib/newsletter/campaign.ts';
import {
  assertDeliveryApproval,
  deliverCampaignBatch,
  type DeliveryCampaign,
} from '../src/lib/newsletter/delivery.ts';
import { campaignStatus } from '../src/lib/newsletter/campaign-status.ts';
import { productionSendConfig } from '../src/lib/newsletter/production-send.ts';
import {
  NEWSLETTER_FROM,
  NEWSLETTER_REPLY_TO,
} from '../src/lib/newsletter/email.ts';
import { recordSesEvent } from '../src/lib/newsletter/events.ts';
import type { SnsEnvelope } from '../src/lib/newsletter/sns.ts';

const root = mkdtempSync('/tmp/newsletter-delivery-pg-');
const bin = process.env.NEWSLETTER_TEST_PG_BIN ?? '/usr/lib/postgresql/16/bin';
const env = {
  PATH: process.env.PATH,
  PGHOST: root,
  PGPORT: '55439',
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
// Turn the final result into JSON without nesting a data-modifying WITH.
// All values are synthetic, correctly quoted SQL literals.
const db = (async (parts: TemplateStringsArray, ...values: unknown[]) => {
  const query = parts.reduce(
    (text, part, i) =>
      text + part + (i < values.length ? literal(values[i]) : ''),
    '',
  );
  let wrapped: string;
  if (/^\s*WITH/i.test(query)) {
    // Our production CTEs finish with SELECT (snapshot), UPDATE (claim/finalize),
    // or no result (event reconciliation). The final statement is at column 0
    // after trim of each line's shared indentation.
    const markers = [
      ...query.matchAll(
        /\n\s*(SELECT new_campaign\.\*|UPDATE campaign_recipients SET status = 'sending'|UPDATE campaigns SET batch_accepted|SELECT count\(\*\)::int AS count FROM suppressed)/g,
      ),
    ];
    const last = markers.at(-1);
    if (!last) {
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
const markdown =
  '---\ntitle: "Synthetic edition"\ndescription: "Synthetic preheader"\n---\n\nTest newsletter.\n';
const articleId = 'synthetic/index.md';
const config = productionSendConfig({
  NEWSLETTER_ENVIRONMENT: 'production',
  AWS_REGION: 'us-east-2',
  SES_CONFIGURATION_SET: 'synthetic',
  NEWSLETTER_MAX_PRODUCTION_RECIPIENTS: '20000',
  NEWSLETTER_MAX_PRODUCTION_SENDS: '200',
  NEWSLETTER_UNSUBSCRIBE_SECRET: 'synthetic-secret-at-least-32-bytes-long',
});
const hash = campaignContentHash(
  articleId,
  'Synthetic edition',
  markdown,
  undefined,
  config.presentation,
);
const account = {
  productionAccessEnabled: true,
  sendingEnabled: true,
  max24HourSend: 200,
  sentLast24Hours: 0,
  maxSendRate: 10,
};
let campaign!: DeliveryCampaign;
let expected = 0;
const sent: string[] = [];
const options = () => ({
  campaign,
  markdown,
  config,
  expected,
  expectedHash: hash,
  sendLimit: 200,
  db,
  account,
  wait: async () => {},
  send: async (
    command: Parameters<Parameters<typeof deliverCampaignBatch>[0]['send']>[0],
  ) => {
    assert.equal(command.input.FromEmailAddress, NEWSLETTER_FROM);
    assert.deepEqual(command.input.ReplyToAddresses, [NEWSLETTER_REPLY_TO]);
    assert.equal(command.input.ConfigurationSetName, 'synthetic');
    const address = command.input.Destination!.ToAddresses![0];
    assert.ok(!sent.includes(address), 'no duplicate SES request');
    assert.match(
      command.input.Content!.Simple!.Body!.Html!.Data!,
      /unsubscribe\?token=/,
    );
    sent.push(address);
    return { MessageId: `synthetic-${sent.length}` };
  },
});
async function fixture(count: number) {
  sql(
    'TRUNCATE campaign_recipients, campaigns, subscribers, newsletter_event_receipts',
  );
  // Highest two subscription dates tie; deterministic UUID order must win.
  sql(`INSERT INTO subscribers (id,email,email_normalized,status,source,unsubscribe_token_hash,consent_provenance,original_subscribed_at)
    SELECT ('00000000-0000-0000-0000-' || lpad(i::text,12,'0'))::uuid,
      'reader' || i || '@example.com','reader' || i || '@example.com','active','manual','synthetic','synthetic',
      '2026-01-01'::timestamptz + (i / 2) * interval '1 hour'
    FROM generate_series(1,${count}) i`);
  expected = count;
  sent.length = 0;
  const snap = await snapshotCampaign(
    {
      articleId,
      markdown,
      subject: 'Synthetic edition',
      contentHash: hash,
      expected,
      maximum: config.maxRecipients,
      cohortSize: null,
    },
    db,
  );
  campaign = { ...snap, article_slug: articleId, subject: 'Synthetic edition' };
  return snap;
}
let started = false;
try {
  pg('initdb', ['-D', `${root}/data`, '-A', 'trust', '--no-locale']);
  pg('pg_ctl', [
    '-D',
    `${root}/data`,
    '-l',
    `${root}/server.log`,
    '-o',
    `-F -k ${root} -p 55439 -c listen_addresses=''`,
    '-w',
    'start',
  ]);
  started = true;
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
  // Exercise the migration against an existing attempted campaign too.
  sql(`INSERT INTO subscribers (email,email_normalized,status,source,unsubscribe_token_hash,consent_provenance,original_subscribed_at)
    VALUES ('legacy@example.com','legacy@example.com','active','manual','legacy','synthetic','2025-01-01');
    INSERT INTO campaigns (article_slug,subject,status) VALUES ('legacy','Legacy','sending');
    INSERT INTO campaign_recipients (campaign_id,subscriber_id,status,provider_message_id)
      SELECT c.id,s.id,'sent','legacy-message' FROM campaigns c CROSS JOIN subscribers s`);
  sql(
    readFileSync(
      new URL(
        '../migrations/newsletter/006_phased_delivery.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  assert.equal(sql('SELECT status FROM campaigns'), 'sending');
  assert.equal(
    sql(
      "SELECT status || ':' || provider_message_id || ':' || EXTRACT(YEAR FROM subscribed_at_snapshot)::int FROM campaign_recipients",
    ),
    'sent:legacy-message:2025',
  );
  console.log(
    'PASS migration preserves existing attempted ledger and backfills ordering',
  );
  const snap = await fixture(5118);
  assert.equal(snap.recipient_count, 5118);
  const first = await deliverCampaignBatch(options());
  assert.equal(first.accepted, 200);
  assert.equal(first.pending, 4918);
  assert.equal(first.status, 'paused');
  assert.deepEqual(sent.slice(0, 3), [
    'reader5118@example.com',
    'reader5116@example.com',
    'reader5117@example.com',
  ]);
  // Changing source dates cannot change the snapshotted send order.
  sql(
    "UPDATE subscribers SET original_subscribed_at = '2099-01-01' WHERE email_normalized = 'reader1@example.com'",
  );
  const second = await deliverCampaignBatch(options());
  assert.equal(second.accepted, 200);
  assert.equal(second.pending, 4718);
  assert.equal(second.status, 'paused');
  assert.equal(new Set(sent).size, 400);
  assert.ok(!sent.includes('reader1@example.com'));
  let status = await campaignStatus(campaign.id, db);
  assert.equal(status.total, 5118);
  assert.equal(status.sent, 400);
  assert.equal(status.batch_accepted, 200);
  const retry = await snapshotCampaign(
    {
      articleId,
      markdown,
      subject: campaign.subject,
      contentHash: hash,
      expected,
      maximum: config.maxRecipients,
      cohortSize: null,
    },
    db,
  );
  assert.equal(retry.id, campaign.id);
  assert.equal(retry.created, false);
  await assert.rejects(() =>
    snapshotCampaign(
      {
        articleId,
        markdown,
        subject: campaign.subject,
        contentHash: hash,
        expected: 200,
        maximum: 20000,
        cohortSize: 200,
      },
      db,
    ),
  );
  console.log(
    'PASS 5,118 snapshot; 200 + 200 bounded waves; frozen recent-first ordering; no duplicates; article idempotency',
  );

  await fixture(3);
  // Both callers begin from the same draft; the second loses the atomic CAS.
  let concurrentChecked = false;
  const normal = options();
  await deliverCampaignBatch({
    ...normal,
    send: async (command) => {
      if (!concurrentChecked) {
        concurrentChecked = true;
        await assert.rejects(() => deliverCampaignBatch(options()), /busy/);
      }
      return normal.send(command);
    },
  });
  assert.equal(sent.length, 3);
  assert.equal((await campaignStatus(campaign.id, db)).status, 'completed');
  await assert.rejects(() => deliverCampaignBatch(options()), /completed/);
  console.log(
    'PASS concurrent invocation refusal and completion only after exhaustion',
  );

  await fixture(4);
  sql(
    "UPDATE subscribers SET status = 'unsubscribed' WHERE email_normalized = 'reader4@example.com'",
  );
  const before = options();
  await deliverCampaignBatch({
    ...before,
    send: async (command) => {
      sql(
        "UPDATE subscribers SET status = 'complained' WHERE email_normalized = 'reader1@example.com'",
      );
      return before.send(command);
    },
  });
  assert.deepEqual(sent, ['reader2@example.com', 'reader3@example.com']);
  status = await campaignStatus(campaign.id, db);
  assert.equal(status.suppressed_skipped, 2);
  assert.equal(status.failed, 0);
  assert.equal(status.status, 'completed');
  console.log('PASS suppression between snapshot/send and during wave');

  // Race suppression after claim, before subscriber's active-guarded update.
  await fixture(1);
  const racedDb = (async (
    parts: TemplateStringsArray,
    ...values: unknown[]
  ) => {
    if (
      parts.join('').includes('UPDATE subscribers SET unsubscribe_token_hash')
    )
      sql("UPDATE subscribers SET status = 'bounced'");
    return db(parts, ...values);
  }) as unknown as NeonDb;
  assert.equal(
    (await deliverCampaignBatch({ ...options(), db: racedDb })).accepted,
    0,
  );
  assert.equal((await campaignStatus(campaign.id, db)).suppressed_skipped, 1);

  for (const outcome of ['rejection', 'timeout', 'missing-message-id']) {
    await fixture(2);
    let calls = 0;
    await assert.rejects(
      () =>
        deliverCampaignBatch({
          ...options(),
          send: async () => {
            calls++;
            if (outcome === 'missing-message-id') return {};
            throw new Error(outcome + ': sensitive@example.com');
          },
        }),
      /reconcile/,
    );
    assert.equal(calls, 1);
    status = await campaignStatus(campaign.id, db);
    assert.equal(status.status, 'sending');
    assert.equal(status.indeterminate, 1);
    assert.equal(status.pending, 1);
    await assert.rejects(() => deliverCampaignBatch(options()), /busy/);
  }
  console.log('PASS rejection, timeout, unknown outcome; no automatic retry');

  await fixture(2);
  sql(
    `UPDATE campaign_recipients SET status = 'sending' WHERE campaign_id = '${campaign.id}' AND subscriber_id = (SELECT id FROM subscribers LIMIT 1)`,
  );
  // Even manually changing the parent to paused cannot bypass unresolved sends.
  sql(`UPDATE campaigns SET status = 'paused' WHERE id = '${campaign.id}'`);
  await assert.rejects(() => deliverCampaignBatch(options()), /indeterminate/);
  assert.equal(sent.length, 0);
  console.log('PASS crash recovery refuses unresolved sending rows');

  for (const point of ['finalize', 'reconcile', 'checkpoint']) {
    await fixture(2);
    const failing = (async (
      parts: TemplateStringsArray,
      ...values: unknown[]
    ) => {
      const text = parts.join('');
      if (
        (point === 'finalize' && text.includes('WITH finalized')) ||
        (point === 'reconcile' && text.includes('event_state')) ||
        (point === 'checkpoint' && text.includes('status = CASE WHEN EXISTS'))
      )
        throw new Error('synthetic DB failure');
      return db(parts, ...values);
    }) as unknown as NeonDb;
    await assert.rejects(() =>
      deliverCampaignBatch({ ...options(), db: failing }),
    );
    status = await campaignStatus(campaign.id, db);
    assert.equal(status.status, 'sending');
    assert.equal(status.indeterminate, point === 'finalize' ? 1 : 0);
    assert.equal(
      status.batch_accepted,
      point === 'finalize' ? 0 : point === 'reconcile' ? 1 : 2,
    );
    await assert.rejects(() => deliverCampaignBatch(options()), /busy/);
  }
  console.log(
    'PASS partial finalization, reconciliation failure, checkpoint failure retain campaign lock',
  );

  await fixture(3);
  for (const override of [
    { sendLimit: 201 },
    { sendLimit: 0 },
    { sendLimit: Number.NaN },
    { expected: 2 },
    { expectedHash: undefined },
    { expectedHash: 'a'.repeat(64) },
    { markdown: markdown + 'Changed article.' },
    { markdown: markdown.replace('Synthetic edition', 'Changed subject') },
    { config: { ...config, maxRecipients: 2 } },
    {
      config: {
        ...config,
        presentation: { ...config.presentation, preheader: false },
      },
    },
    { account: { ...account, max24HourSend: 2 } },
    { account: { ...account, maxSendRate: 0 } },
    { account: { ...account, sendingEnabled: false } },
    { account: { ...account, productionAccessEnabled: false } },
  ]) {
    await assert.rejects(() =>
      deliverCampaignBatch({ ...options(), ...override }),
    );
    assert.equal((await campaignStatus(campaign.id, db)).status, 'draft');
  }
  assert.equal(sent.length, 0);
  await assert.rejects(
    () =>
      snapshotCampaign(
        {
          articleId: 'other',
          markdown,
          subject: 'Synthetic edition',
          contentHash: hash,
          expected: 5118,
          maximum: 5000,
          cohortSize: null,
        },
        db,
      ),
    /maximum/,
  );
  assert.throws(() =>
    productionSendConfig({
      ...process.env,
      NEWSLETTER_ENVIRONMENT: 'production',
    }),
  );
  assert.throws(() =>
    assertDeliveryApproval(campaign, markdown, config, expected, hash, -1),
  );
  console.log(
    'PASS quota/access/rate, audience/send ceilings, exact count/hash, source/subject/renderer drift guards',
  );

  let stop = false;
  const graceful = options();
  const partial = await deliverCampaignBatch({
    ...graceful,
    shouldStop: () => stop,
    send: async (command) => {
      stop = true;
      return graceful.send(command);
    },
  });
  assert.equal(partial.accepted, 1);
  assert.equal(partial.status, 'paused');
  assert.equal(partial.pending, 2);
  await deliverCampaignBatch(options());
  assert.equal((await campaignStatus(campaign.id, db)).status, 'completed');
  const event = (eventType: string, messageId: string, extra: object = {}) =>
    ({
      MessageId: `${eventType}-${messageId}`,
      Message: JSON.stringify({ eventType, mail: { messageId }, ...extra }),
    }) as SnsEnvelope;
  await recordSesEvent(
    event('Delivery', 'synthetic-1', {
      delivery: { timestamp: '2026-10-31T12:00:00Z' },
    }),
    db,
  );
  await recordSesEvent(
    event('Bounce', 'synthetic-2', {
      bounce: {
        bounceType: 'Permanent',
        bouncedRecipients: [{ emailAddress: sent[1] }],
      },
    }),
    db,
  );
  await recordSesEvent(
    event('Complaint', 'synthetic-3', {
      complaint: { complainedRecipients: [{ emailAddress: sent[2] }] },
    }),
    db,
  );
  status = await campaignStatus(campaign.id, db);
  assert.equal(status.delivered, 1);
  assert.equal(status.sent, 1);
  assert.equal(status.bounced, 1);
  assert.equal(status.complained, 1);
  assert.doesNotMatch(JSON.stringify(status), /@|secret|token/);
  console.log(
    'PASS graceful stop/resume; SNS reconciliation; read-only PII-free status counts',
  );

  // SNS can arrive before the sender persists the SES message ID.
  await fixture(1);
  const early = options();
  await deliverCampaignBatch({
    ...early,
    send: async (command) => {
      await recordSesEvent(
        event('Delivery', 'synthetic-1', {
          delivery: { timestamp: '2026-10-31T12:00:00Z' },
        }),
        db,
      );
      return early.send(command);
    },
  });
  assert.equal((await campaignStatus(campaign.id, db)).delivered, 1);

  // Explicitly abandoning an uncertain synthetic attempt releases only this
  // stopped batch and never returns its recipient to the pending population.
  await fixture(2);
  await assert.rejects(() =>
    deliverCampaignBatch({
      ...options(),
      send: async () => {
        throw new Error('lost response');
      },
    }),
  );
  const stopped = await campaignStatus(campaign.id, db);
  sql(
    `UPDATE campaign_recipients SET status = 'failed', error_detail = 'indeterminate abandoned' WHERE campaign_id = '${campaign.id}' AND status = 'sending'`,
  );
  const released =
    await db`UPDATE campaigns SET status = 'paused', batch_finished_at = now()
    WHERE id = ${campaign.id} AND status = 'sending' AND batch_id = ${stopped.batch_id}
      AND NOT EXISTS (SELECT 1 FROM campaign_recipients WHERE campaign_id = ${campaign.id} AND status = 'sending')
    RETURNING id`;
  assert.equal(released.length, 1);
  await deliverCampaignBatch(options());
  status = await campaignStatus(campaign.id, db);
  assert.equal(status.failed, 1);
  assert.equal(status.sent, 1);
  assert.equal(status.pending, 0);
  assert.equal(status.status, 'completed');
  assert.equal(sent.length, 1);
  console.log(
    'PASS early SNS reconciliation and explicit stopped-batch recovery without retrying uncertainty',
  );

  console.log(
    'PASS all phased delivery Postgres tests (synthetic only; no SES calls)',
  );
} finally {
  if (started)
    pg('pg_ctl', ['-D', `${root}/data`, '-m', 'immediate', '-w', 'stop']);
  rmSync(root, { recursive: true, force: true });
}
