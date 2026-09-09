import { GetAccountCommand, SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';
import { readNewsletterArticle, renderNewsletterEmail } from '../../src/lib/newsletter/render.ts';
import { NEWSLETTER_FROM, NEWSLETTER_PRIVACY_URL, NEWSLETTER_REPLY_TO } from '../../src/lib/newsletter/email.ts';
import { newsletterDb } from '../../src/lib/newsletter/db.ts';
import { hashToken } from '../../src/lib/newsletter/tokens.ts';
import { reconcileSesMessage } from '../../src/lib/newsletter/events.ts';
import {
  assertRecipientScope,
  assertSesAccountReady,
  parseExpectedRecipients,
  productionSendConfig,
  subscriberUnsubscribeToken,
} from '../../src/lib/newsletter/production-send.ts';

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const campaignId = process.argv[2];
if (!campaignId || !process.argv.includes('--confirm-production')) {
  throw new Error('Usage: npm run newsletter:send -- <campaign-id> --expect-recipients <count> --confirm-production');
}
const expected = parseExpectedRecipients(option('--expect-recipients'));
const config = productionSendConfig(process.env);
const db = newsletterDb();
const campaigns = await db`
  SELECT id, article_slug, subject, status,
    (SELECT count(*)::int FROM campaign_recipients WHERE campaign_id = campaigns.id) AS recipient_count,
    (SELECT count(*)::int FROM campaign_recipients WHERE campaign_id = campaigns.id AND status = 'sending') AS indeterminate_count
  FROM campaigns WHERE id = ${campaignId}`;
if (campaigns.length !== 1) throw new Error('Campaign was not found. No email was sent.');
const campaign = campaigns[0] as {
  id: string; article_slug: string; subject: string; status: string; recipient_count: number; indeterminate_count: number;
};
if (campaign.status !== 'draft') throw new Error(`Campaign status is ${campaign.status}; manual reconciliation is required and no email was sent.`);
if (campaign.indeterminate_count > 0) {
  throw new Error('Campaign has an indeterminate sending recipient. Reconcile it manually; no email was sent.');
}
assertRecipientScope(expected, campaign.recipient_count, config.maxRecipients);

const markdown = readNewsletterArticle(campaign.article_slug);
renderNewsletterEmail({
  articleId: campaign.article_slug,
  title: campaign.subject,
  markdown,
  privacyUrl: NEWSLETTER_PRIVACY_URL,
  unsubscribeUrl: 'https://leonlins.com/api/newsletter/unsubscribe?token=preflight-placeholder',
});

const ses = new SESv2Client({ region: config.awsRegion });
const account = await ses.send(new GetAccountCommand({}));
await db`UPDATE campaign_recipients SET status = 'failed', error_detail = 'suppressed before send'
  WHERE campaign_id = ${campaignId} AND status = 'pending'
    AND subscriber_id IN (SELECT id FROM subscribers WHERE status <> 'active')`;
const pending = await db`SELECT count(*)::int AS count FROM campaign_recipients WHERE campaign_id = ${campaignId} AND status = 'pending'`;
const pendingCount = Number(pending[0]?.count ?? 0);
const { delayMs } = assertSesAccountReady({
  productionAccessEnabled: account.ProductionAccessEnabled,
  sendingEnabled: account.SendingEnabled,
  max24HourSend: account.SendQuota?.Max24HourSend,
  maxSendRate: account.SendQuota?.MaxSendRate,
  sentLast24Hours: account.SendQuota?.SentLast24Hours,
}, pendingCount);
const started = await db`UPDATE campaigns SET status = 'sending', started_at = COALESCE(started_at, now())
  WHERE id = ${campaignId} AND status = 'draft' RETURNING id`;
if (started.length !== 1) throw new Error('Another process changed the campaign; no email was sent.');

let sent = 0;
let skipped = 0;
while (true) {
  const claimed = await db`
    WITH candidate AS (
      SELECT campaign_recipients.subscriber_id
      FROM campaign_recipients
      JOIN subscribers ON subscribers.id = campaign_recipients.subscriber_id
      WHERE campaign_recipients.campaign_id = ${campaignId}
        AND campaign_recipients.status = 'pending'
        AND subscribers.status = 'active'
      ORDER BY campaign_recipients.subscriber_id
      LIMIT 1
    )
    UPDATE campaign_recipients SET status = 'sending', attempt_started_at = now(), error_detail = NULL
    WHERE campaign_id = ${campaignId} AND subscriber_id = (SELECT subscriber_id FROM candidate)
      AND status = 'pending'
    RETURNING subscriber_id`;
  if (claimed.length === 0) break;
  const subscriberId = String(claimed[0].subscriber_id);
  const token = subscriberUnsubscribeToken(subscriberId, config.unsubscribeSecret);
  const subscribers = await db`
    UPDATE subscribers SET unsubscribe_token_hash = ${hashToken(token)}, updated_at = now()
    WHERE id = ${subscriberId} AND status = 'active'
    RETURNING email_normalized`;
  if (subscribers.length === 0) {
    await db`UPDATE campaign_recipients SET status = 'failed', error_detail = 'suppressed before send'
      WHERE campaign_id = ${campaignId} AND subscriber_id = ${subscriberId} AND status = 'sending'`;
    skipped += 1;
    continue;
  }
  const unsubscribeUrl = new URL('/api/newsletter/unsubscribe', NEWSLETTER_PRIVACY_URL);
  unsubscribeUrl.searchParams.set('token', token);
  const rendered = renderNewsletterEmail({
    articleId: campaign.article_slug,
    title: campaign.subject,
    markdown,
    privacyUrl: NEWSLETTER_PRIVACY_URL,
    unsubscribeUrl: unsubscribeUrl.toString(),
  });
  let messageId: string;
  try {
    const result = await ses.send(new SendEmailCommand({
      FromEmailAddress: NEWSLETTER_FROM,
      ReplyToAddresses: [NEWSLETTER_REPLY_TO],
      Destination: { ToAddresses: [String(subscribers[0].email_normalized)] },
      ConfigurationSetName: config.configurationSet,
      Content: {
        Simple: {
          Subject: { Data: campaign.subject, Charset: 'UTF-8' },
          Body: {
            Html: { Data: rendered.html, Charset: 'UTF-8' },
            Text: { Data: rendered.text, Charset: 'UTF-8' },
          },
          Headers: Object.entries(rendered.headers).map(([Name, Value]) => ({ Name, Value })),
        },
      },
    }));
    if (!result.MessageId) throw new Error('SES accepted the request without returning a message id.');
    messageId = result.MessageId;
  } catch (error) {
    console.error('Send outcome is indeterminate; the recipient remains in sending state and will not be retried automatically.');
    throw error;
  }
  console.log(`SES accepted recipient ${sent + 1}; message id: ${messageId}`);
  try {
    const recorded = await db`UPDATE campaign_recipients SET status = 'sent', provider_message_id = ${messageId}, sent_at = now()
      WHERE campaign_id = ${campaignId} AND subscriber_id = ${subscriberId} AND status = 'sending'
      RETURNING subscriber_id`;
    if (recorded.length !== 1) throw new Error('The claimed campaign recipient could not be finalized.');
    await reconcileSesMessage(messageId, db);
  } catch (error) {
    console.error('SES accepted the message, but database finalization is incomplete. Do not rerun; reconcile manually.');
    throw error;
  }
  sent += 1;
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

const remaining = await db`
  SELECT count(*) FILTER (WHERE status = 'pending')::int AS pending,
    count(*) FILTER (WHERE status = 'sending')::int AS sending
  FROM campaign_recipients WHERE campaign_id = ${campaignId}`;
if (Number(remaining[0]?.pending ?? 0) === 0 && Number(remaining[0]?.sending ?? 0) === 0) {
  await db`UPDATE campaigns SET status = 'completed', completed_at = now() WHERE id = ${campaignId} AND status = 'sending'`;
}
console.log(JSON.stringify({ campaignId, sent, skipped, remaining: remaining[0] }, null, 2));
