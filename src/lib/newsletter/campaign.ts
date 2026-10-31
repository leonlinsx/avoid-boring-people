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
  const rows = await db`
    WITH eligible AS MATERIALIZED (
      SELECT id, COALESCE(original_subscribed_at, confirmed_at, created_at) AS subscribed_at_snapshot
      FROM subscribers WHERE status = 'active'
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
