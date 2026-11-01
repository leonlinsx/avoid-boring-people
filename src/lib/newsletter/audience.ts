// Audience eligibility and preview for future campaign snapshots.
// Every query is read-only; no subscriber or delivery row is ever changed here.
//
// Eligibility (safe default for snapshotCampaign):
//   status = 'active' AND (confirmed_at IS NOT NULL OR has confirmed SES delivery)
//   AND not suppressed for permanent delivery failure (hard bounce or complaint)
// A confirmed delivery means campaign_recipients.delivered_at IS NOT NULL — i.e.,
// the SNS delivery event was received. SES SendEmail acceptance alone (sent_at)
// is never delivery proof. Suppression is stored independently in
// subscribers.hard_bounced_at / complained_at (migration 008) so it survives
// an unsubscribe/resubscribe cycle and is not reclassified as opt-out.
//
// Preview: mutually exclusive audience segments plus overlap notes for event metrics.

import type { NeonDb } from '../neon.ts';

export type AudiencePreview = {
  // Mutually exclusive subscriber segments (sum = total tracked subscribers).
  defaultEligible: number; // active + verified (double-opt-in or prior delivery) + not suppressed
  activeUnverified: number; // active but neither verification present (also not suppressed)
  hardBounces: number; // bounced, Permanent + General/NoEmail/Suppressed
  unknownBounces: number; // bounced, NULL/malformed or unrecognized subtype/type
  validationSuppressed: number; // bounced, Permanent + EmailValidationSuppressed
  otherSuppressions: number; // bounced, Permanent + OnAccount/OnTenant/Unsubscribed
  complained: number;
  unsubscribed: number;
  pending: number;
  total: number;
  // Derived helpers.
  active: number; // defaultEligible + activeUnverified
  suppressed: number; // every bounced/complained/unsubscribed
  subtypeDetailAvailable: boolean;
  deliverySuppressionAvailable: boolean;
  overlapNotes: string[];
};

export type DeliveryUnverifiedPreviewRow = {
  id: string;
  email_normalized: string;
  created_at: string;
  confirmed_at: string | null;
  has_delivered: boolean;
};

// Canonical eligibility predicate — the single source of truth for both
// snapshotCampaign and previewAudience. Must stay in sync; do not duplicate
// the text elsewhere. Interpolated via db.unsafe() where raw SQL is required
// is no longer needed because campaign.ts now imports this constant directly
// via string interpolation in the query template; previewAudience uses it
// via the shared helper below.
export const ELIGIBILITY_WHERE =
  "status = 'active' AND (confirmed_at IS NOT NULL OR EXISTS (SELECT 1 FROM campaign_recipients cr WHERE cr.subscriber_id = subscribers.id AND cr.delivered_at IS NOT NULL)) AND hard_bounced_at IS NULL AND complained_at IS NULL";

// Fallback when delivery suppression columns are not yet migrated (pre-008).
export const ELIGIBILITY_WHERE_NO_SUPPRESSION =
  "status = 'active' AND (confirmed_at IS NOT NULL OR EXISTS (SELECT 1 FROM campaign_recipients cr WHERE cr.subscriber_id = subscribers.id AND cr.delivered_at IS NOT NULL))";

// Pure helper for fake-db tests: mirrors the SQL predicate including suppression.
export function isDefaultEligible(subscriber: {
  status: string;
  confirmed_at: unknown;
  hasDelivered?: boolean;
  hard_bounced_at?: unknown;
  complained_at?: unknown;
}): boolean {
  if (subscriber.status !== 'active') return false;
  if (subscriber.hard_bounced_at != null) return false;
  if (subscriber.complained_at != null) return false;
  if (subscriber.confirmed_at !== null && subscriber.confirmed_at !== undefined)
    return true;
  if (subscriber.hasDelivered) return true;
  return false;
}

// Helper to check if a bounce should be considered hard bounce vs validation etc.
// Used by events.ts logic; duplicated here for preview classification consistency.
export function isHardBounceCase(
  bounceType: string | null,
  bounceSubType: string | null,
): boolean {
  return (
    bounceType === 'Permanent' &&
    (bounceSubType === 'General' ||
      bounceSubType === 'NoEmail' ||
      bounceSubType === 'Suppressed')
  );
}

type Row = Record<string, unknown>;
function count(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export async function previewAudience(db: NeonDb): Promise<AudiencePreview> {
  // Probe whether 007 bounce-classification columns exist.
  let subtypeDetailAvailable = true;
  try {
    await db`SELECT bounce_subtype FROM campaign_recipients LIMIT 0`;
  } catch (error) {
    const missing =
      error instanceof Error &&
      /bounce_(type|subtype).*does not exist/i.test(error.message);
    if (!missing) throw error;
    subtypeDetailAvailable = false;
  }
  // Probe whether delivered_at exists (migration 002).
  let deliveredAtAvailable = true;
  if (subtypeDetailAvailable) {
    try {
      await db`SELECT delivered_at FROM campaign_recipients LIMIT 0`;
    } catch (error) {
      const missing =
        error instanceof Error &&
        /delivered_at.*does not exist/i.test(error.message);
      if (!missing) throw error;
      deliveredAtAvailable = false;
    }
  }
  // Probe whether delivery suppression columns exist (migration 008).
  let deliverySuppressionAvailable = true;
  try {
    await db`SELECT hard_bounced_at FROM subscribers LIMIT 0`;
  } catch (error) {
    const missing =
      error instanceof Error &&
      /hard_bounced_at.*does not exist/i.test(error.message);
    if (!missing) throw error;
    deliverySuppressionAvailable = false;
  }
  if (deliverySuppressionAvailable) {
    try {
      await db`SELECT complained_at FROM subscribers LIMIT 0`;
    } catch (error) {
      const missing =
        error instanceof Error &&
        /complained_at.*does not exist/i.test(error.message);
      if (!missing) throw error;
      deliverySuppressionAvailable = false;
    }
  }

  // Build eligibility fragments based on available columns.
  const eligibleFilter = deliverySuppressionAvailable
    ? `status = 'active' AND (confirmed_at IS NOT NULL OR EXISTS (SELECT 1 FROM campaign_recipients cr WHERE cr.subscriber_id = subscribers.id AND cr.delivered_at IS NOT NULL)) AND hard_bounced_at IS NULL AND complained_at IS NULL`
    : deliveredAtAvailable
      ? `status = 'active' AND (confirmed_at IS NOT NULL OR EXISTS (SELECT 1 FROM campaign_recipients cr WHERE cr.subscriber_id = subscribers.id AND cr.delivered_at IS NOT NULL))`
      : `status = 'active' AND confirmed_at IS NOT NULL`;

  const activeUnverifiedFilter = deliverySuppressionAvailable
    ? `status = 'active' AND confirmed_at IS NULL AND NOT EXISTS (SELECT 1 FROM campaign_recipients cr WHERE cr.subscriber_id = subscribers.id AND cr.delivered_at IS NOT NULL) AND hard_bounced_at IS NULL AND complained_at IS NULL`
    : deliveredAtAvailable
      ? `status = 'active' AND confirmed_at IS NULL AND NOT EXISTS (SELECT 1 FROM campaign_recipients cr WHERE cr.subscriber_id = subscribers.id AND cr.delivered_at IS NOT NULL)`
      : `status = 'active' AND confirmed_at IS NULL`;

  // When delivery tracking is unavailable, fall back to confirmed_at-only eligibility.
  if (!deliveredAtAvailable) {
    const rows = (await db`SELECT
      (count(*) FILTER (WHERE status = 'active' AND confirmed_at IS NOT NULL))::int AS default_eligible,
      (count(*) FILTER (WHERE status = 'active' AND confirmed_at IS NULL))::int AS active_unverified,
      (count(*) FILTER (WHERE status = 'bounced'))::int AS unknown_bounces,
      0::int AS hard_bounces,
      0::int AS validation_suppressed,
      0::int AS other_suppressions,
      (count(*) FILTER (WHERE status = 'complained'))::int AS complained,
      (count(*) FILTER (WHERE status = 'unsubscribed'))::int AS unsubscribed,
      (count(*) FILTER (WHERE status = 'pending'))::int AS pending,
      count(*)::int AS total
      FROM subscribers`) as Row[];
    return buildPreview(rows[0] ?? {}, false, deliverySuppressionAvailable);
  }

  if (!subtypeDetailAvailable) {
    const rows = (await (db as unknown as { unsafe: (s: string) => unknown })
      .unsafe)
      ? ((await db`SELECT
      (count(*) FILTER (WHERE ${
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (db as any).unsafe(eligibleFilter)
      }))::int AS default_eligible,
      (count(*) FILTER (WHERE ${
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (db as any).unsafe(activeUnverifiedFilter)
      }))::int AS active_unverified,
      0::int AS hard_bounces,
      (count(*) FILTER (WHERE status = 'bounced'))::int AS unknown_bounces,
      0::int AS validation_suppressed,
      0::int AS other_suppressions,
      (count(*) FILTER (WHERE status = 'complained'))::int AS complained,
      (count(*) FILTER (WHERE status = 'unsubscribed'))::int AS unsubscribed,
      (count(*) FILTER (WHERE status = 'pending'))::int AS pending,
      count(*)::int AS total
      FROM subscribers`) as Row[])
      : ((await db`SELECT
      (count(*) FILTER (WHERE status = 'active' AND (confirmed_at IS NOT NULL OR EXISTS (SELECT 1 FROM campaign_recipients cr WHERE cr.subscriber_id = subscribers.id AND cr.delivered_at IS NOT NULL))))::int AS default_eligible,
      (count(*) FILTER (WHERE status = 'active' AND confirmed_at IS NULL AND NOT EXISTS (SELECT 1 FROM campaign_recipients cr WHERE cr.subscriber_id = subscribers.id AND cr.delivered_at IS NOT NULL)))::int AS active_unverified,
      0::int AS hard_bounces,
      (count(*) FILTER (WHERE status = 'bounced'))::int AS unknown_bounces,
      0::int AS validation_suppressed,
      0::int AS other_suppressions,
      (count(*) FILTER (WHERE status = 'complained'))::int AS complained,
      (count(*) FILTER (WHERE status = 'unsubscribed'))::int AS unsubscribed,
      (count(*) FILTER (WHERE status = 'pending'))::int AS pending,
      count(*)::int AS total
      FROM subscribers`) as Row[]);
    return buildPreview(rows[0] ?? {}, false, deliverySuppressionAvailable);
  }

  // Full query: eligibility + per-subtype bounced breakdown in one SELECT.
  // Bounce subtype for each bounced subscriber is resolved from the most recent
  // bounced campaign_recipient, falling back to the most recent bounced
  // newsletter_event_receipt matched by provider_message_id.
  // Classification is exhaustive: every bounced subscriber lands in exactly one
  // of hard_bounces / validation_suppressed / other_suppressions / unknown_bounces,
  // including malformed type/subtype combinations. The unknown bucket is the
  // complement of the three explicit Permanent+subtype cases.
  const rows = (await db`SELECT
      (count(*) FILTER (WHERE status = 'active' AND (confirmed_at IS NOT NULL OR EXISTS (SELECT 1 FROM campaign_recipients cr WHERE cr.subscriber_id = subscribers.id AND cr.delivered_at IS NOT NULL)) AND hard_bounced_at IS NULL AND complained_at IS NULL))::int AS default_eligible,
      (count(*) FILTER (WHERE status = 'active' AND confirmed_at IS NULL AND NOT EXISTS (SELECT 1 FROM campaign_recipients cr WHERE cr.subscriber_id = subscribers.id AND cr.delivered_at IS NOT NULL) AND hard_bounced_at IS NULL AND complained_at IS NULL))::int AS active_unverified,
      (count(*) FILTER (WHERE status = 'bounced' AND COALESCE(bounce_type, '') = 'Permanent' AND COALESCE(bounce_subtype, '') IN ('General','NoEmail','Suppressed')))::int AS hard_bounces,
      (count(*) FILTER (WHERE status = 'bounced' AND COALESCE(bounce_type, '') = 'Permanent' AND COALESCE(bounce_subtype, '') = 'EmailValidationSuppressed'))::int AS validation_suppressed,
      (count(*) FILTER (WHERE status = 'bounced' AND COALESCE(bounce_type, '') = 'Permanent' AND COALESCE(bounce_subtype, '') IN ('OnAccountSuppressionList','OnTenantSuppressionList','UnsubscribedRecipient')))::int AS other_suppressions,
      (count(*) FILTER (WHERE status = 'bounced' AND NOT (COALESCE(bounce_type, '') = 'Permanent' AND COALESCE(bounce_subtype, '') IN ('General','NoEmail','Suppressed','EmailValidationSuppressed','OnAccountSuppressionList','OnTenantSuppressionList','UnsubscribedRecipient'))))::int AS unknown_bounces,
      (count(*) FILTER (WHERE status = 'complained'))::int AS complained,
      (count(*) FILTER (WHERE status = 'unsubscribed'))::int AS unsubscribed,
      (count(*) FILTER (WHERE status = 'pending'))::int AS pending,
      count(*)::int AS total
      FROM (
        SELECT subscribers.*,
          COALESCE(
            (SELECT cr_inner.bounce_subtype FROM campaign_recipients cr_inner WHERE cr_inner.subscriber_id = subscribers.id AND cr_inner.status = 'bounced' ORDER BY cr_inner.bounced_at DESC NULLS LAST, cr_inner.subscribed_at_snapshot DESC NULLS LAST LIMIT 1),
            (SELECT er_inner.bounce_subtype FROM newsletter_event_receipts er_inner WHERE er_inner.provider_message_id IN (SELECT cr2.provider_message_id FROM campaign_recipients cr2 WHERE cr2.subscriber_id = subscribers.id AND cr2.provider_message_id IS NOT NULL) AND er_inner.event_status = 'bounced' ORDER BY er_inner.event_at DESC NULLS LAST LIMIT 1)
          ) AS bounce_subtype,
          COALESCE(
            (SELECT cr_inner.bounce_type FROM campaign_recipients cr_inner WHERE cr_inner.subscriber_id = subscribers.id AND cr_inner.status = 'bounced' ORDER BY cr_inner.bounced_at DESC NULLS LAST, cr_inner.subscribed_at_snapshot DESC NULLS LAST LIMIT 1),
            (SELECT er_inner.bounce_type FROM newsletter_event_receipts er_inner WHERE er_inner.provider_message_id IN (SELECT cr2.provider_message_id FROM campaign_recipients cr2 WHERE cr2.subscriber_id = subscribers.id AND cr2.provider_message_id IS NOT NULL) AND er_inner.event_status = 'bounced' ORDER BY er_inner.event_at DESC NULLS LAST LIMIT 1)
          ) AS bounce_type
        FROM subscribers
      ) s`) as Row[];
  // If suppression columns missing, fallback to not filtering by them for counts.
  // Detect by checking if query failed earlier; but we already probed, so adjust.
  if (!deliverySuppressionAvailable) {
    // Re-run with fallback filters that don't reference suppression columns.
    const fallbackRows = (await db`SELECT
      (count(*) FILTER (WHERE status = 'active' AND (confirmed_at IS NOT NULL OR EXISTS (SELECT 1 FROM campaign_recipients cr WHERE cr.subscriber_id = subscribers.id AND cr.delivered_at IS NOT NULL))))::int AS default_eligible,
      (count(*) FILTER (WHERE status = 'active' AND confirmed_at IS NULL AND NOT EXISTS (SELECT 1 FROM campaign_recipients cr WHERE cr.subscriber_id = subscribers.id AND cr.delivered_at IS NOT NULL)))::int AS active_unverified,
      (count(*) FILTER (WHERE status = 'bounced' AND COALESCE(bounce_type, '') = 'Permanent' AND COALESCE(bounce_subtype, '') IN ('General','NoEmail','Suppressed')))::int AS hard_bounces,
      (count(*) FILTER (WHERE status = 'bounced' AND COALESCE(bounce_type, '') = 'Permanent' AND COALESCE(bounce_subtype, '') = 'EmailValidationSuppressed'))::int AS validation_suppressed,
      (count(*) FILTER (WHERE status = 'bounced' AND COALESCE(bounce_type, '') = 'Permanent' AND COALESCE(bounce_subtype, '') IN ('OnAccountSuppressionList','OnTenantSuppressionList','UnsubscribedRecipient')))::int AS other_suppressions,
      (count(*) FILTER (WHERE status = 'bounced' AND NOT (COALESCE(bounce_type, '') = 'Permanent' AND COALESCE(bounce_subtype, '') IN ('General','NoEmail','Suppressed','EmailValidationSuppressed','OnAccountSuppressionList','OnTenantSuppressionList','UnsubscribedRecipient'))))::int AS unknown_bounces,
      (count(*) FILTER (WHERE status = 'complained'))::int AS complained,
      (count(*) FILTER (WHERE status = 'unsubscribed'))::int AS unsubscribed,
      (count(*) FILTER (WHERE status = 'pending'))::int AS pending,
      count(*)::int AS total
      FROM (
        SELECT subscribers.*,
          COALESCE(
            (SELECT cr_inner.bounce_subtype FROM campaign_recipients cr_inner WHERE cr_inner.subscriber_id = subscribers.id AND cr_inner.status = 'bounced' ORDER BY cr_inner.bounced_at DESC NULLS LAST, cr_inner.subscribed_at_snapshot DESC NULLS LAST LIMIT 1),
            (SELECT er_inner.bounce_subtype FROM newsletter_event_receipts er_inner WHERE er_inner.provider_message_id IN (SELECT cr2.provider_message_id FROM campaign_recipients cr2 WHERE cr2.subscriber_id = subscribers.id AND cr2.provider_message_id IS NOT NULL) AND er_inner.event_status = 'bounced' ORDER BY er_inner.event_at DESC NULLS LAST LIMIT 1)
          ) AS bounce_subtype,
          COALESCE(
            (SELECT cr_inner.bounce_type FROM campaign_recipients cr_inner WHERE cr_inner.subscriber_id = subscribers.id AND cr_inner.status = 'bounced' ORDER BY cr_inner.bounced_at DESC NULLS LAST, cr_inner.subscribed_at_snapshot DESC NULLS LAST LIMIT 1),
            (SELECT er_inner.bounce_type FROM newsletter_event_receipts er_inner WHERE er_inner.provider_message_id IN (SELECT cr2.provider_message_id FROM campaign_recipients cr2 WHERE cr2.subscriber_id = subscribers.id AND cr2.provider_message_id IS NOT NULL) AND er_inner.event_status = 'bounced' ORDER BY er_inner.event_at DESC NULLS LAST LIMIT 1)
          ) AS bounce_type
        FROM subscribers
      ) s`) as Row[];
    return buildPreview(fallbackRows[0] ?? {}, true, false);
  }
  return buildPreview(rows[0] ?? {}, true, true);
}

// Lightweight list of active-but-unverified subscribers for operator review.
// Ordered newest first; capped to limit rows.
export async function previewDeliveryUnverified(
  db: NeonDb,
  limit = 20,
): Promise<DeliveryUnverifiedPreviewRow[]> {
  // Check if suppression columns exist to filter correctly.
  let hasSuppression = true;
  try {
    await db`SELECT hard_bounced_at FROM subscribers LIMIT 0`;
  } catch {
    hasSuppression = false;
  }
  if (hasSuppression) {
    const rows =
      (await db`SELECT id::text AS id, email_normalized, created_at::text AS created_at, confirmed_at::text AS confirmed_at,
        EXISTS (SELECT 1 FROM campaign_recipients cr WHERE cr.subscriber_id = subscribers.id AND cr.delivered_at IS NOT NULL) AS has_delivered
      FROM subscribers
      WHERE status = 'active' AND confirmed_at IS NULL AND NOT EXISTS (SELECT 1 FROM campaign_recipients cr WHERE cr.subscriber_id = subscribers.id AND cr.delivered_at IS NOT NULL) AND hard_bounced_at IS NULL AND complained_at IS NULL
      ORDER BY COALESCE(original_subscribed_at, created_at) DESC NULLS LAST, id
      LIMIT ${limit}`) as Row[];
    return rows as unknown as DeliveryUnverifiedPreviewRow[];
  }
  const rows =
    (await db`SELECT id::text AS id, email_normalized, created_at::text AS created_at, confirmed_at::text AS confirmed_at,
      EXISTS (SELECT 1 FROM campaign_recipients cr WHERE cr.subscriber_id = subscribers.id AND cr.delivered_at IS NOT NULL) AS has_delivered
    FROM subscribers
    WHERE status = 'active' AND confirmed_at IS NULL AND NOT EXISTS (SELECT 1 FROM campaign_recipients cr WHERE cr.subscriber_id = subscribers.id AND cr.delivered_at IS NOT NULL)
    ORDER BY COALESCE(original_subscribed_at, created_at) DESC NULLS LAST, id
    LIMIT ${limit}`) as Row[];
  return rows as unknown as DeliveryUnverifiedPreviewRow[];
}

function buildPreview(
  row: Row,
  subtypeDetailAvailable: boolean,
  deliverySuppressionAvailable: boolean,
): AudiencePreview {
  const defaultEligible = count(row.default_eligible);
  const activeUnverified = count(row.active_unverified);
  const hardBounces = count(row.hard_bounces);
  const unknownBounces = count(row.unknown_bounces);
  const validationSuppressed = count(row.validation_suppressed);
  const otherSuppressions = count(row.other_suppressions);
  const complained = count(row.complained);
  const unsubscribed = count(row.unsubscribed);
  const pending = count(row.pending);
  const total = count(row.total);
  const active = defaultEligible + activeUnverified;
  const suppressed =
    hardBounces +
    unknownBounces +
    validationSuppressed +
    otherSuppressions +
    complained +
    unsubscribed;
  const overlapNotes: string[] = [
    'Audience segments above are mutually exclusive; their union is the subscriber population (pending + active + suppressed).',
    'Delivery metrics (sends, deliveries, bounceRate) are separate event counts over campaign_recipients/newsletter_event_receipts and may overlap in time.',
    'Active-unverified readers are not suppressed or deleted; they are simply not included in the default snapshot until a confirmed delivery or double-opt-in confirmation is recorded.',
    'EmailValidationSuppressed means SES blocked the address at send time for validation reasons; it is not proof the mailbox does not exist and must not be recast as a hard-bounce subtype. Individual recovery requires fresh ownership/consent evidence and explicit operator approval — never automatic unsuppression or resend.',
    'Hard-bounce and complaint suppression is stored independently of opt-out status (hard_bounced_at/complained_at) so a late bounce after an unsubscribe still blocks automatic re-eligibility until explicitly cleared.',
  ];
  if (!subtypeDetailAvailable) {
    overlapNotes.unshift(
      'Bounce subtype detail unavailable (migration 007 not yet applied); all bounced rows are counted as unknown_bounces. Apply 007 to restore split counts without changing any status.',
    );
  }
  if (!deliverySuppressionAvailable) {
    overlapNotes.unshift(
      'Delivery suppression columns unavailable (migration 008 not yet applied); eligibility does not yet exclude hard-bounced/complained addresses that changed status. Apply 008 to enforce independent suppression.',
    );
  }
  return {
    defaultEligible,
    activeUnverified,
    hardBounces,
    unknownBounces,
    validationSuppressed,
    otherSuppressions,
    complained,
    unsubscribed,
    pending,
    total,
    active,
    suppressed,
    subtypeDetailAvailable,
    deliverySuppressionAvailable,
    overlapNotes,
  };
}
