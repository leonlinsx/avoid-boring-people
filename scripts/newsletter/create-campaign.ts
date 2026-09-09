import { readNewsletterArticle, renderNewsletterEmail } from '../../src/lib/newsletter/render.ts';
import { NEWSLETTER_PRIVACY_URL } from '../../src/lib/newsletter/email.ts';
import { newsletterDb } from '../../src/lib/newsletter/db.ts';
import { assertRecipientScope, parseExpectedRecipients, productionSendConfig } from '../../src/lib/newsletter/production-send.ts';

function frontmatterTitle(markdown: string): string | null {
  return markdown.match(/^title:\s*['\"]?(.+?)['\"]?\s*$/m)?.[1]?.trim() ?? null;
}

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const articleId = process.argv[2];
if (!articleId || !process.argv.includes('--confirm-snapshot')) {
  throw new Error('Usage: npm run newsletter:campaign -- <article-id> --expect-recipients <count> --confirm-snapshot');
}
const expected = parseExpectedRecipients(option('--expect-recipients'));
const config = productionSendConfig(process.env);
assertRecipientScope(expected, expected, config.maxRecipients);

const markdown = readNewsletterArticle(articleId);
const subject = frontmatterTitle(markdown);
if (!subject) throw new Error('The selected article has no title. No campaign was created.');
renderNewsletterEmail({
  articleId,
  title: subject,
  markdown,
  privacyUrl: NEWSLETTER_PRIVACY_URL,
  unsubscribeUrl: 'https://leonlins.com/api/newsletter/unsubscribe?token=preflight-placeholder',
});

const db = newsletterDb();
const rows = await db`
  WITH eligible AS MATERIALIZED (
    SELECT id FROM subscribers WHERE status = 'active'
  ), new_campaign AS (
    INSERT INTO campaigns (article_slug, subject, status)
    SELECT ${articleId}, ${subject}, 'draft'
    WHERE (SELECT count(*) FROM eligible) = ${expected}
    ON CONFLICT (article_slug) DO NOTHING
    RETURNING id, status
  ), snapshot AS (
    INSERT INTO campaign_recipients (campaign_id, subscriber_id, status)
    SELECT new_campaign.id, eligible.id, 'pending'
    FROM new_campaign CROSS JOIN eligible
    RETURNING campaign_id
  )
  SELECT new_campaign.id, new_campaign.status,
    (SELECT count(*)::int FROM snapshot) AS recipient_count,
    true AS created
  FROM new_campaign
  UNION ALL
  SELECT campaigns.id, campaigns.status,
    (SELECT count(*)::int FROM campaign_recipients WHERE campaign_id = campaigns.id) AS recipient_count,
    false AS created
  FROM campaigns
  WHERE article_slug = ${articleId} AND NOT EXISTS (SELECT 1 FROM new_campaign)`;

if (rows.length !== 1) throw new Error(`Active recipient count did not equal ${expected}; no campaign was created.`);
const campaign = rows[0] as { id: string; status: string; recipient_count: number; created: boolean };
assertRecipientScope(expected, campaign.recipient_count, config.maxRecipients);
console.log(JSON.stringify({
  campaignId: campaign.id,
  status: campaign.status,
  recipients: campaign.recipient_count,
  created: campaign.created,
  emailSent: false,
}, null, 2));
