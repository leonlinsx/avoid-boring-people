import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { newsletterDb } from '../../src/lib/newsletter/db.ts';
import { importTimestamp, planSubstackImport } from '../../src/lib/newsletter/importer.ts';
import { subscriberUnsubscribeToken } from '../../src/lib/newsletter/production-send.ts';
import { hashToken } from '../../src/lib/newsletter/tokens.ts';

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function expectedCount(name: string): number {
  const value = Number(option(name));
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${name} must be a non-negative integer. No subscribers were imported.`);
  return value;
}

const inputPath = process.argv[2];
if (!inputPath || !process.argv.includes('--confirm-import')) {
  throw new Error('Usage: npm run newsletter:import -- <substack-export.csv> --expect-active <count> --expect-suppressed <count> --confirm-import');
}
if (process.env.NEWSLETTER_ENVIRONMENT !== 'production') {
  throw new Error('NEWSLETTER_ENVIRONMENT must be exactly "production". No subscribers were imported.');
}
const secret = process.env.NEWSLETTER_UNSUBSCRIBE_SECRET;
if (!secret || Buffer.byteLength(secret) < 32) {
  throw new Error('NEWSLETTER_UNSUBSCRIBE_SECRET must contain at least 32 bytes. No subscribers were imported.');
}

const plan = planSubstackImport(await readFile(inputPath, 'utf8'));
const expectedActive = expectedCount('--expect-active');
const expectedSuppressed = expectedCount('--expect-suppressed');
if (plan.summary.active !== expectedActive || plan.summary.suppressed !== expectedSuppressed) {
  throw new Error(`Import counts changed: expected ${expectedActive} active/${expectedSuppressed} suppressed, found ${plan.summary.active} active/${plan.summary.suppressed} suppressed. No subscribers were imported.`);
}

const db = newsletterDb();
const batches = Array.from({ length: Math.ceil(plan.subscribers.length / 100) }, (_, index) => plan.subscribers.slice(index * 100, (index + 1) * 100));
let processed = 0;
for (const batch of batches) {
  const queries = batch.map((subscriber) => {
    const id = randomUUID();
    const originalSubscribedAt = importTimestamp(subscriber.originalSubscribedAt);
    const cancelDate = importTimestamp(subscriber.legacySubstackCancelDate);
    const sourceDetail = JSON.stringify({
      import: 'substack',
      cancelDateRaw: subscriber.legacySubstackCancelDate,
    });
    const unsubscribeHash = hashToken(subscriberUnsubscribeToken(id, secret));
    return db`INSERT INTO subscribers (
        id, email, email_normalized, name, status, source, source_detail,
        original_subscribed_at, unsubscribed_at, confirmation_token_hash,
        unsubscribe_token_hash, legacy_substack_type, legacy_substack_cancel_date,
        consent_provenance, imported_at
      ) VALUES (
        ${id}, ${subscriber.email}, ${subscriber.email}, ${subscriber.name},
        ${subscriber.status}::newsletter_subscriber_status, 'substack_import', ${sourceDetail},
        ${originalSubscribedAt}::timestamptz,
        ${subscriber.status === 'unsubscribed' ? cancelDate ?? new Date().toISOString() : null}::timestamptz,
        NULL, ${unsubscribeHash}, ${subscriber.legacySubstackType}, ${cancelDate}::timestamptz,
        'substack_export', now()
      )
      ON CONFLICT (email_normalized) DO UPDATE SET
        name = COALESCE(subscribers.name, EXCLUDED.name),
        status = CASE
          WHEN subscribers.status IN ('unsubscribed', 'bounced', 'complained') THEN subscribers.status
          WHEN EXCLUDED.status = 'unsubscribed' THEN 'unsubscribed'::newsletter_subscriber_status
          WHEN subscribers.status = 'pending' AND EXCLUDED.status = 'active' THEN 'active'::newsletter_subscriber_status
          ELSE subscribers.status
        END,
        source_detail = CASE
          WHEN subscribers.imported_at IS NULL THEN concat_ws(E'\n', subscribers.source_detail, EXCLUDED.source_detail)
          ELSE subscribers.source_detail
        END,
        original_subscribed_at = COALESCE(subscribers.original_subscribed_at, EXCLUDED.original_subscribed_at),
        unsubscribed_at = CASE
          WHEN subscribers.status IN ('unsubscribed', 'bounced', 'complained') THEN subscribers.unsubscribed_at
          WHEN EXCLUDED.status = 'unsubscribed' THEN COALESCE(subscribers.unsubscribed_at, EXCLUDED.unsubscribed_at)
          ELSE subscribers.unsubscribed_at
        END,
        confirmation_token_hash = CASE
          WHEN subscribers.status = 'pending' THEN NULL
          ELSE subscribers.confirmation_token_hash
        END,
        consent_provenance = CASE
          WHEN subscribers.status = 'pending' AND EXCLUDED.status = 'active' THEN EXCLUDED.consent_provenance
          ELSE subscribers.consent_provenance
        END,
        legacy_substack_type = COALESCE(subscribers.legacy_substack_type, EXCLUDED.legacy_substack_type),
        legacy_substack_cancel_date = COALESCE(subscribers.legacy_substack_cancel_date, EXCLUDED.legacy_substack_cancel_date),
        imported_at = COALESCE(subscribers.imported_at, now()),
        updated_at = now()
      RETURNING id`;
  });
  await db.transaction(queries);
  processed += batch.length;
}

console.log(JSON.stringify({
  mode: 'applied',
  processed,
  ...plan.summary,
  emailSent: false,
}, null, 2));
