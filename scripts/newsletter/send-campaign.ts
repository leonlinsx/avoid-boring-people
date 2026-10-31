import {
  assertDeliveryApproval,
  deliverCampaignBatch,
} from '../../src/lib/newsletter/delivery.ts';
import { assertPublishedNewsletterPage } from '../../src/lib/newsletter/presentation.ts';
import { assertPublicNewsletterImages } from '../../src/lib/newsletter/public-images.ts';
import { CAMPAIGN_UNSUBSCRIBE_PLACEHOLDER } from '../../src/lib/newsletter/campaign.ts';
import { GetAccountCommand, SESv2Client } from '@aws-sdk/client-sesv2';
import {
  readNewsletterArticle,
  renderNewsletterEmail,
} from '../../src/lib/newsletter/render.ts';
import { NEWSLETTER_PRIVACY_URL } from '../../src/lib/newsletter/email.ts';
import { neonDb } from '../../src/lib/neon.ts';
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

async function main() {
  const campaignId = process.argv[2];
  if (!campaignId || !process.argv.includes('--confirm-production')) {
    throw new Error(
      'Usage: npm run newsletter:send -- <campaign-id> --expect-recipients <count> --expect-content <preview-sha256> --send-limit <count> --confirm-production',
    );
  }
  const expected = parseExpectedRecipients(option('--expect-recipients'));
  const config = productionSendConfig(process.env);
  const sendLimit = parseExpectedRecipients(option('--send-limit'));
  const db = neonDb('Newsletter');
  const campaigns = await db`
  SELECT id, article_slug, subject, status, content_hash,
    (SELECT count(*)::int FROM campaign_recipients WHERE campaign_id = campaigns.id) AS recipient_count,
    (SELECT count(*)::int FROM campaign_recipients WHERE campaign_id = campaigns.id AND status = 'sending') AS indeterminate_count
  FROM campaigns WHERE id = ${campaignId}`;
  if (campaigns.length !== 1)
    throw new Error('Campaign was not found. No email was sent.');
  const campaign = campaigns[0] as {
    id: string;
    article_slug: string;
    subject: string;
    content_hash: string | null;
    status: string;
    recipient_count: number;
    indeterminate_count: number;
  };
  if (
    !['draft', 'paused'].includes(campaign.status) ||
    campaign.indeterminate_count > 0
  )
    throw new Error(
      'Campaign is busy, completed, or indeterminate. No email was sent.',
    );
  const markdown = readNewsletterArticle(campaign.article_slug);
  assertDeliveryApproval(
    campaign,
    markdown,
    config,
    expected,
    option('--expect-content'),
    sendLimit,
  );

  await assertPublishedNewsletterPage(campaign.article_slug, markdown);
  await assertPublicNewsletterImages(
    renderNewsletterEmail({
      ...config.presentation,
      articleId: campaign.article_slug,
      markdown,
      title: campaign.subject,
      privacyUrl: NEWSLETTER_PRIVACY_URL,
      unsubscribeUrl: CAMPAIGN_UNSUBSCRIBE_PLACEHOLDER,
    }).html,
  );

  // SES SendEmail has no idempotency key. Never let SDK retries duplicate a
  // request whose response was lost. A timeout remains an unresolved sending row.
  const ses = new SESv2Client({ region: config.awsRegion, maxAttempts: 1 });
  const account = await ses.send(new GetAccountCommand({}));
  let stopping = false;
  const stop = () => {
    stopping = true;
    console.log(
      'Stop requested; finishing the in-flight recipient before checkpoint.',
    );
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  try {
    const result = await deliverCampaignBatch({
      campaign,
      markdown,
      config,
      expected,
      expectedHash: option('--expect-content'),
      sendLimit,
      db,
      account: {
        productionAccessEnabled: account.ProductionAccessEnabled,
        sendingEnabled: account.SendingEnabled,
        max24HourSend: account.SendQuota?.Max24HourSend,
        maxSendRate: account.SendQuota?.MaxSendRate,
        sentLast24Hours: account.SendQuota?.SentLast24Hours,
      },
      send: (command) => ses.send(command),
      shouldStop: () => stopping,
      progress: (counts) => console.log(JSON.stringify(counts)),
    });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    process.off('SIGINT', stop);
    process.off('SIGTERM', stop);
    ses.destroy();
  }
}
main().catch(() => {
  // Provider/DB exceptions can contain addresses, parameters or credentials.
  console.error(
    'Newsletter delivery refused or interrupted. Inspect campaign status; do not reset or retry uncertain recipients. Check approvals, configured ceilings, content, SES quota and database availability.',
  );
  process.exitCode = 1;
});
