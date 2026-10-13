import { randomUUID } from 'node:crypto';
import type { NeonDb } from '../neon.ts';
import {
  assertImportApproval,
  importTimestamp,
  type SubstackImportPlan,
  type ImportApproval,
} from './importer.ts';
import { subscriberUnsubscribeToken } from './production-send.ts';
import { hashToken } from './tokens.ts';

// This immutable marker identifies retries of the exact approved export. No
// migration table, campaign, or send operation is involved.
function payload(plan: SubstackImportPlan) {
  return plan.subscribers.map((subscriber) => ({
    email: subscriber.email,
    name: subscriber.name,
    status: subscriber.status,
    original_subscribed_at: importTimestamp(subscriber.originalSubscribedAt),
    cancel_date: importTimestamp(subscriber.legacySubstackCancelDate),
    legacy_type: subscriber.legacySubstackType,
    source_detail: JSON.stringify({
      import: 'substack',
      rosterFingerprint: plan.rosterFingerprint,
      fileFingerprint: plan.fileFingerprint,
      cancelDateRaw: subscriber.legacySubstackCancelDate,
      ...subscriber.historicalMetadata,
    }),
  }));
}

export async function preflightSubstackImport(
  db: NeonDb,
  plan: SubstackImportPlan,
) {
  const data = JSON.stringify(payload(plan));
  const [rows] = await db.transaction(
    [
      db`WITH incoming AS (
      SELECT * FROM jsonb_to_recordset(${data}::jsonb)
        AS r(email text, status text, source_detail text)
    ), matched AS (
      SELECT r.*, s.id, s.status AS existing_status,
        (s.source = 'substack_import' AND s.consent_provenance = 'substack_export'
          AND s.imported_at IS NOT NULL AND s.source_detail = r.source_detail
          AND s.status <> 'pending') AS same_import,
        s.confirmation_token_hash, s.confirmation_expires_at
      FROM incoming r LEFT JOIN subscribers s ON s.email_normalized = r.email
    ) SELECT
      (SELECT count(*)::integer FROM subscribers) AS "existingSubscribers",
      (SELECT count(*)::integer FROM campaigns) AS "existingCampaigns",
      (SELECT count(*)::integer FROM campaign_recipients) AS "existingCampaignRecipients",
      (SELECT count(*)::integer FROM subscribers) + count(*) FILTER (WHERE id IS NULL)::integer AS "predictedTotalSubscribers",
      (SELECT count(*)::integer FROM subscribers WHERE status = 'active')
        + count(*) FILTER (WHERE id IS NULL AND status = 'active')::integer
        - count(*) FILTER (WHERE existing_status = 'active' AND status = 'unsubscribed')::integer AS "predictedTotalActive",
      (SELECT count(*)::integer FROM subscribers WHERE status IN ('unsubscribed', 'bounced', 'complained'))
        + count(*) FILTER (WHERE id IS NULL AND status = 'unsubscribed')::integer
        + count(*) FILTER (WHERE existing_status = 'active' AND status = 'unsubscribed')::integer AS "predictedTotalSuppressed",
      (SELECT count(*)::integer FROM subscribers WHERE status = 'pending') AS "existingPending",
      (SELECT count(*)::integer FROM subscribers WHERE status = 'active') AS "existingActive",
      (SELECT count(*)::integer FROM subscribers WHERE status IN ('unsubscribed', 'bounced', 'complained')) AS "existingSuppressed",
      count(*) FILTER (WHERE id IS NOT NULL)::integer AS "collisions",
      count(*) FILTER (WHERE existing_status = 'pending')::integer AS "pendingCollisions",
      count(*) FILTER (WHERE id IS NOT NULL AND same_import IS NOT TRUE)::integer AS "unexpectedCollisions",
      count(*) FILTER (WHERE same_import)::integer AS "resumableRows",
      count(*) FILTER (WHERE id IS NULL AND status = 'active')::integer AS "newActive",
      count(*) FILTER (WHERE id IS NULL AND status = 'unsubscribed')::integer AS "newSuppressed",
      count(*) FILTER (WHERE existing_status IN ('unsubscribed', 'bounced', 'complained'))::integer AS "preservedSuppressions",
      count(*) FILTER (WHERE status = 'unsubscribed' AND id IS NOT NULL AND
        (confirmation_token_hash IS NOT NULL OR confirmation_expires_at IS NOT NULL))::integer AS "cancellationCredentialsToClear",
      count(*) FILTER (WHERE status = 'active' AND (id IS NULL OR existing_status = 'active'))::integer AS "predictedRosterActive",
      count(*) FILTER (WHERE status = 'unsubscribed' OR existing_status IN ('unsubscribed', 'bounced', 'complained'))::integer AS "predictedRosterSuppressed"
    FROM matched`,
    ],
    { readOnly: true },
  );
  return rows[0];
}

export async function applySubstackImport(
  db: NeonDb,
  plan: SubstackImportPlan,
  approval: ImportApproval,
  secret: string,
) {
  assertImportApproval(plan, approval);
  if (Buffer.byteLength(secret) < 32)
    throw new Error('Import unsubscribe secret is too short.');
  const data = JSON.stringify(
    payload(plan).map((row) => {
      const id = randomUUID();
      return {
        ...row,
        id,
        unsubscribe_hash: hashToken(subscriberUnsubscribeToken(id, secret)),
      };
    }),
  );
  // A table lock closes the SELECT/upsert race with public signup, unsubscribe,
  // event ingestion and another importer. Bounded waits fail without partial
  // progress. READ COMMITTED sees changes committed before the lock was granted.
  const results = await db.transaction(
    [
      db`SET LOCAL lock_timeout = '5s'`,
      db`SET LOCAL statement_timeout = '60s'`,
      db`LOCK TABLE subscribers IN SHARE ROW EXCLUSIVE MODE`,
      // An aggregate-only guard produces no address-bearing SQL error. Anything
      // other than an exact retry (including pending collisions) aborts the whole
      // transaction before inserting any rows.
      db`WITH incoming AS (
      SELECT * FROM jsonb_to_recordset(${data}::jsonb)
        AS r(email text, source_detail text)
    ) SELECT 1 / CASE WHEN count(*) = 0 THEN 1 ELSE 0 END AS guard
      FROM incoming r JOIN subscribers s ON s.email_normalized = r.email
      WHERE s.status = 'pending' OR s.source <> 'substack_import'
        OR s.consent_provenance <> 'substack_export' OR s.imported_at IS NULL
        OR s.source_detail IS DISTINCT FROM r.source_detail`,
      db`INSERT INTO subscribers (
      id, email, email_normalized, name, status, source, source_detail,
      original_subscribed_at, unsubscribed_at, confirmation_token_hash,
      confirmation_expires_at, unsubscribe_token_hash, legacy_substack_type,
      legacy_substack_cancel_date, consent_provenance, imported_at
    ) SELECT r.id::uuid, r.email, r.email, r.name,
      r.status::newsletter_subscriber_status, 'substack_import', r.source_detail,
      r.original_subscribed_at::timestamptz, r.cancel_date::timestamptz,
      NULL, NULL, r.unsubscribe_hash, r.legacy_type, r.cancel_date::timestamptz,
      'substack_export', now()
    FROM jsonb_to_recordset(${data}::jsonb) AS r(
      id text, email text, name text, status text, source_detail text,
      original_subscribed_at text, cancel_date text, unsubscribe_hash text, legacy_type text
    )
    ON CONFLICT (email_normalized) DO UPDATE SET
      status = CASE WHEN subscribers.status IN ('unsubscribed', 'bounced', 'complained')
        THEN subscribers.status ELSE 'unsubscribed'::newsletter_subscriber_status END,
      unsubscribed_at = COALESCE(subscribers.unsubscribed_at, EXCLUDED.unsubscribed_at),
      confirmation_token_hash = NULL,
      confirmation_expires_at = NULL,
      updated_at = now()
    WHERE EXCLUDED.status = 'unsubscribed' AND (
      subscribers.status = 'active' OR subscribers.confirmation_token_hash IS NOT NULL
      OR subscribers.confirmation_expires_at IS NOT NULL
    )
    RETURNING status`,
    ],
    { isolationLevel: 'ReadCommitted' },
  );
  return { affectedRows: results[4].length, emailSent: false };
}
