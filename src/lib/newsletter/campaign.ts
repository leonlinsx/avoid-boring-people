import {
  newsletterPresentation,
  newsletterMetadata,
  type NewsletterPresentation,
} from './presentation.ts';
import { assertPublishedArticle } from '../../utils/publication.ts';
import { createHash } from 'node:crypto';
import { neonDb } from '../neon.ts';
import { NEWSLETTER_PRIVACY_URL } from './email.ts';
import { renderNewsletterEmail } from './render.ts';
import { assertRecipientScope } from './production-send.ts';
import {
  ELIGIBILITY_WHERE,
  ELIGIBILITY_WHERE_NO_SUPPRESSION,
} from './audience.ts';

export const CAMPAIGN_UNSUBSCRIBE_PLACEHOLDER =
  'https://leonlins.com/api/newsletter/unsubscribe?token=preflight-placeholder';

export function newsletterTitle(markdown: string): string {
  const { title } = newsletterMetadata(markdown);
  if (!title) throw new Error('The selected article has no title.');
  return title;
}

// Hash the rendered subject, HTML, text and headers with only the per-recipient
// unsubscribe token replaced by a fixed placeholder. Renderer/footer changes
// therefore require another preview too. Never hash a real unsubscribe token.
export function campaignContentHash(
  articleId: string,
  subject: string,
  markdown: string,
  privacyUrl = NEWSLETTER_PRIVACY_URL,
  presentation: NewsletterPresentation = newsletterPresentation(process.env),
): string {
  assertPublishedArticle(markdown);
  const rendered = renderNewsletterEmail({
    ...presentation,
    articleId,
    title: subject,
    markdown,
    privacyUrl,
    unsubscribeUrl: CAMPAIGN_UNSUBSCRIBE_PLACEHOLDER,
  });
  return createHash('sha256')
    .update(JSON.stringify({ subject, ...rendered }))
    .digest('hex');
}

export function assertCampaignContent(
  expected: string | undefined | null,
  actual: string,
): void {
  if (!expected || !/^[0-9a-f]{64}$/.test(expected) || expected !== actual)
    throw new Error(
      'Campaign content differs from the approved preview or has no approved digest. No email was sent.',
    );
}

export function warmupCohortSize(
  value: string | undefined,
  expected: number,
): number | null {
  if (value === undefined) return null;
  const size = Number(value);
  if (
    !/^[0-9]+$/.test(value) ||
    !Number.isInteger(size) ||
    size < 200 ||
    size > 300 ||
    size !== expected
  )
    throw new Error(
      '--cohort-size must be 200–300 and equal --expect-recipients.',
    );
  return size;
}

export async function snapshotCampaign(
  input: {
    articleId: string;
    markdown: string;
    subject: string;
    contentHash: string;
    expected: number;
    maximum: number;
    cohortSize: number | null;
  },
  db = neonDb('Newsletter'),
) {
  assertPublishedArticle(input.markdown);
  const { articleId, subject, contentHash, expected, maximum, cohortSize } =
    input;
  assertRecipientScope(expected, expected, maximum);
  if (cohortSize !== null) warmupCohortSize(String(cohortSize), expected);
  const selection =
    cohortSize === null ? 'all-active' : `recent-subscribers:${cohortSize}`;
  // Delivery suppression (008) is required for new campaign snapshots.
  // If the columns are absent, fail closed rather than silently including
  // hard-bounced/complained addresses. Existing campaigns are unaffected
  // (ON CONFLICT path) but the error still fires so the operator knows to
  // apply the migration. For synthetic/disposable test DBs that intentionally
  // lack 008, set NEWSLETTER_ALLOW_MISSING_SUPPRESSION=1 to permit the
  // legacy path; production must never set this.
  let hasSuppression = true;
  try {
    await db`SELECT hard_bounced_at FROM subscribers LIMIT 0`;
  } catch (error) {
    const missing =
      error instanceof Error &&
      /hard_bounced_at.*does not exist/i.test(error.message);
    if (!missing) throw error;
    hasSuppression = false;
  }
  if (hasSuppression) {
    try {
      await db`SELECT complained_at FROM subscribers LIMIT 0`;
    } catch (error) {
      const missing =
        error instanceof Error &&
        /complained_at.*does not exist/i.test(error.message);
      if (!missing) throw error;
      hasSuppression = false;
    }
  }
  if (!hasSuppression) {
    if (process.env.NEWSLETTER_ALLOW_MISSING_SUPPRESSION !== '1') {
      throw new Error(
        'Campaign snapshot requires migration 008_delivery_suppression (subscribers.hard_bounced_at / complained_at). Apply the migration before creating new campaigns.',
      );
    }
  }
  const eligibleWhere = hasSuppression
    ? ELIGIBILITY_WHERE
    : ELIGIBILITY_WHERE_NO_SUPPRESSION;
  // When the DB shim has `unsafe` (real Neon), use the canonical predicate via
  // raw interpolation so campaign and preview cannot drift. The synthetic
  // disposable-DB harnesses have no `unsafe`; they get an equivalent inlined
  // predicate that is kept identical to ELIGIBILITY_WHERE by the test below.
  const hasUnsafe =
    typeof (db as unknown as { unsafe?: unknown }).unsafe === 'function';
  const rows = hasUnsafe
    ? await db`
    WITH eligible AS MATERIALIZED (
      SELECT id, COALESCE(original_subscribed_at, confirmed_at, created_at) AS subscribed_at_snapshot
      FROM subscribers
      WHERE ${
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (db as any).unsafe(eligibleWhere)
      }
      ORDER BY COALESCE(original_subscribed_at, confirmed_at, created_at) DESC, id
      LIMIT ${cohortSize}::int
    ), new_campaign AS (
      INSERT INTO campaigns (article_slug, subject, status, content_hash, recipient_selection)
      SELECT ${articleId}, ${subject}, 'draft', ${contentHash}, ${selection}
      WHERE (SELECT count(*) FROM eligible) = ${expected}
      ON CONFLICT (article_slug) DO NOTHING RETURNING id, status, content_hash, recipient_selection
    ), snapshot AS (
      INSERT INTO campaign_recipients (campaign_id, subscriber_id, status, subscribed_at_snapshot)
      SELECT new_campaign.id, eligible.id, 'pending', eligible.subscribed_at_snapshot FROM new_campaign CROSS JOIN eligible
      RETURNING campaign_id
    )
    SELECT new_campaign.*, (SELECT count(*)::int FROM snapshot) AS recipient_count, true AS created
    FROM new_campaign
    UNION ALL
    SELECT campaigns.id, campaigns.status, campaigns.content_hash, campaigns.recipient_selection,
      (SELECT count(*)::int FROM campaign_recipients WHERE campaign_id = campaigns.id) AS recipient_count, false AS created
    FROM campaigns WHERE article_slug = ${articleId} AND NOT EXISTS (SELECT 1 FROM new_campaign)`
    : hasSuppression
      ? await db`
    WITH eligible AS MATERIALIZED (
      SELECT id, COALESCE(original_subscribed_at, confirmed_at, created_at) AS subscribed_at_snapshot
      FROM subscribers
      WHERE status = 'active' AND (confirmed_at IS NOT NULL OR EXISTS (SELECT 1 FROM campaign_recipients cr WHERE cr.subscriber_id = subscribers.id AND cr.delivered_at IS NOT NULL)) AND hard_bounced_at IS NULL AND complained_at IS NULL
      ORDER BY COALESCE(original_subscribed_at, confirmed_at, created_at) DESC, id
      LIMIT ${cohortSize}::int
    ), new_campaign AS (
      INSERT INTO campaigns (article_slug, subject, status, content_hash, recipient_selection)
      SELECT ${articleId}, ${subject}, 'draft', ${contentHash}, ${selection}
      WHERE (SELECT count(*) FROM eligible) = ${expected}
      ON CONFLICT (article_slug) DO NOTHING RETURNING id, status, content_hash, recipient_selection
    ), snapshot AS (
      INSERT INTO campaign_recipients (campaign_id, subscriber_id, status, subscribed_at_snapshot)
      SELECT new_campaign.id, eligible.id, 'pending', eligible.subscribed_at_snapshot FROM new_campaign CROSS JOIN eligible
      RETURNING campaign_id
    )
    SELECT new_campaign.*, (SELECT count(*)::int FROM snapshot) AS recipient_count, true AS created
    FROM new_campaign
    UNION ALL
    SELECT campaigns.id, campaigns.status, campaigns.content_hash, campaigns.recipient_selection,
      (SELECT count(*)::int FROM campaign_recipients WHERE campaign_id = campaigns.id) AS recipient_count, false AS created
    FROM campaigns WHERE article_slug = ${articleId} AND NOT EXISTS (SELECT 1 FROM new_campaign)`
      : await db`
    WITH eligible AS MATERIALIZED (
      SELECT id, COALESCE(original_subscribed_at, confirmed_at, created_at) AS subscribed_at_snapshot
      FROM subscribers
      WHERE status = 'active' AND (confirmed_at IS NOT NULL OR EXISTS (SELECT 1 FROM campaign_recipients cr WHERE cr.subscriber_id = subscribers.id AND cr.delivered_at IS NOT NULL))
      ORDER BY COALESCE(original_subscribed_at, confirmed_at, created_at) DESC, id
      LIMIT ${cohortSize}::int
    ), new_campaign AS (
      INSERT INTO campaigns (article_slug, subject, status, content_hash, recipient_selection)
      SELECT ${articleId}, ${subject}, 'draft', ${contentHash}, ${selection}
      WHERE (SELECT count(*) FROM eligible) = ${expected}
      ON CONFLICT (article_slug) DO NOTHING RETURNING id, status, content_hash, recipient_selection
    ), snapshot AS (
      INSERT INTO campaign_recipients (campaign_id, subscriber_id, status, subscribed_at_snapshot)
      SELECT new_campaign.id, eligible.id, 'pending', eligible.subscribed_at_snapshot FROM new_campaign CROSS JOIN eligible
      RETURNING campaign_id
    )
    SELECT new_campaign.*, (SELECT count(*)::int FROM snapshot) AS recipient_count, true AS created
    FROM new_campaign
    UNION ALL
    SELECT campaigns.id, campaigns.status, campaigns.content_hash, campaigns.recipient_selection,
      (SELECT count(*)::int FROM campaign_recipients WHERE campaign_id = campaigns.id) AS recipient_count, false AS created
    FROM campaigns WHERE article_slug = ${articleId} AND NOT EXISTS (SELECT 1 FROM new_campaign)`;
  if (rows.length !== 1)
    throw new Error(
      `Eligible recipient count did not equal ${expected}; no campaign was created.`,
    );
  const campaign = rows[0] as {
    id: string;
    status: string;
    content_hash: string | null;
    recipient_selection: string | null;
    recipient_count: number;
    created: boolean;
  };
  assertRecipientScope(expected, campaign.recipient_count, maximum);
  assertCampaignContent(campaign.content_hash, contentHash);
  if (campaign.recipient_selection !== selection)
    throw new Error(
      'Existing campaign has a different recipient selection. No snapshot was changed.',
    );
  return campaign;
}
