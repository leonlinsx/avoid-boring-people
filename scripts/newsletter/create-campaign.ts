import { readNewsletterArticle } from '../../src/lib/newsletter/render.ts';
import {
  assertCampaignContent,
  campaignContentHash,
  newsletterTitle,
  snapshotCampaign,
  warmupCohortSize,
} from '../../src/lib/newsletter/campaign.ts';
import {
  parseExpectedRecipients,
  productionSendConfig,
} from '../../src/lib/newsletter/production-send.ts';

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--'))
    throw new Error(`${name} requires a value.`);
  return value;
}

const articleId = process.argv[2];
if (!articleId || !process.argv.includes('--confirm-snapshot'))
  throw new Error(
    'Usage: npm run newsletter:campaign -- <article-id> --expect-recipients <count> [--cohort-size <200–300>] --expect-content <preview-sha256> --confirm-snapshot',
  );
const expected = parseExpectedRecipients(option('--expect-recipients'));
const config = productionSendConfig(process.env);
const cohortSize = warmupCohortSize(option('--cohort-size'), expected);
const markdown = readNewsletterArticle(articleId);
const subject = newsletterTitle(markdown);
const contentHash = campaignContentHash(articleId, subject, markdown);
assertCampaignContent(option('--expect-content'), contentHash);
const campaign = await snapshotCampaign({
  articleId,
  markdown,
  subject,
  contentHash,
  expected,
  maximum: config.maxRecipients,
  cohortSize,
});
console.log(
  JSON.stringify(
    {
      campaignId: campaign.id,
      status: campaign.status,
      recipients: campaign.recipient_count,
      selection: campaign.recipient_selection,
      contentHash: campaign.content_hash,
      created: campaign.created,
      emailSent: false,
    },
    null,
    2,
  ),
);
