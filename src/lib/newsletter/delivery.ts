import { randomUUID } from 'node:crypto';
import {
  SendEmailCommand,
  type SendEmailCommandOutput,
} from '@aws-sdk/client-sesv2';
import { type NeonDb } from '../neon.ts';
import {
  assertCampaignContent,
  campaignContentHash,
  newsletterTitle,
} from './campaign.ts';
import {
  type ProductionSendConfig,
  type SesAccountState,
  assertRecipientScope,
  assertSendLimit,
  assertSesAccountReady,
  subscriberUnsubscribeToken,
} from './production-send.ts';
import { hashToken } from './tokens.ts';
import { reconcileSesMessage } from './events.ts';
import { renderNewsletterEmail } from './render.ts';
import {
  NEWSLETTER_FROM,
  NEWSLETTER_REPLY_TO,
  NEWSLETTER_PRIVACY_URL,
} from './email.ts';

export type DeliveryCampaign = {
  id: string;
  article_slug: string;
  subject: string;
  content_hash: string | null;
  status: string;
  recipient_count: number;
};

export function assertDeliveryApproval(
  campaign: DeliveryCampaign,
  markdown: string,
  config: ProductionSendConfig,
  expected: number,
  expectedHash: string | undefined,
  sendLimit: number,
) {
  assertRecipientScope(
    expected,
    campaign.recipient_count,
    config.maxRecipients,
  );
  assertSendLimit(sendLimit, config.maxSends);
  if (newsletterTitle(markdown) !== campaign.subject)
    throw new Error('Campaign subject changed. No email was sent.');
  const actual = campaignContentHash(
    campaign.article_slug,
    campaign.subject,
    markdown,
    undefined,
    config.presentation,
  );
  assertCampaignContent(campaign.content_hash, actual);
  assertCampaignContent(expectedHash, actual);
}

// No infrastructure or scheduler: one authorized invocation owns the campaign
// until a clean checkpoint. Exceptions deliberately leave it locked in sending.
export async function deliverCampaignBatch(input: {
  campaign: DeliveryCampaign;
  markdown: string;
  config: ProductionSendConfig;
  expected: number;
  expectedHash: string | undefined;
  sendLimit: number;
  db: NeonDb;
  account: SesAccountState;
  send: (
    command: SendEmailCommand,
  ) => Promise<Pick<SendEmailCommandOutput, 'MessageId'>>;
  shouldStop?: () => boolean;
  wait?: (ms: number) => Promise<void>;
  progress?: (counts: {
    accepted: number;
    attempted: number;
    skipped: number;
    pending: number;
  }) => void;
}) {
  const {
    campaign,
    markdown,
    config,
    expected,
    expectedHash,
    sendLimit,
    db,
    account,
    send,
    shouldStop = () => false,
    wait = (ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
    progress = () => {},
  } = input;
  assertDeliveryApproval(
    campaign,
    markdown,
    config,
    expected,
    expectedHash,
    sendLimit,
  );
  const campaignId = campaign.id;
  const batchId = randomUUID();
  // Validate quota before taking ownership; check only this wave, not the audience.
  const counts =
    await db`SELECT count(*)::int AS count FROM campaign_recipients r
    JOIN subscribers s ON s.id = r.subscriber_id
    WHERE r.campaign_id = ${campaignId} AND r.status = 'pending' AND s.status = 'active'`;
  const { delayMs } = assertSesAccountReady(
    account,
    Math.min(sendLimit, Number(counts[0]?.count ?? 0)),
  );
  const started = await db`UPDATE campaigns SET status = 'sending',
    started_at = COALESCE(started_at, now()), batch_id = ${batchId},
    batch_send_limit = ${sendLimit}, batch_accepted = 0, batch_started_at = now(), batch_finished_at = NULL
    WHERE id = ${campaignId} AND status IN ('draft', 'paused')
      AND content_hash = ${campaign.content_hash}
      AND (SELECT count(*) FROM campaign_recipients WHERE campaign_id = ${campaignId}) = ${expected}
      AND NOT EXISTS (SELECT 1 FROM campaign_recipients WHERE campaign_id = ${campaignId} AND status = 'sending')
    RETURNING id`;
  if (started.length !== 1)
    throw new Error(
      'Campaign is busy, completed, or indeterminate; no email was sent.',
    );
  let sent = 0;
  let skipped = 0;
  let attempted = 0;
  while (attempted < sendLimit && !shouldStop()) {
    const claimed = await db`
    WITH candidate AS (
      SELECT campaign_recipients.subscriber_id
      FROM campaign_recipients
      JOIN subscribers ON subscribers.id = campaign_recipients.subscriber_id
      WHERE campaign_recipients.campaign_id = ${campaignId}
        AND campaign_recipients.status = 'pending'
        AND subscribers.status = 'active'
        AND EXISTS (SELECT 1 FROM campaigns WHERE id = ${campaignId} AND status = 'sending' AND batch_id = ${batchId})
      ORDER BY campaign_recipients.subscribed_at_snapshot DESC, campaign_recipients.subscriber_id
      LIMIT 1
    )
    UPDATE campaign_recipients SET status = 'sending', attempt_started_at = now(), error_detail = NULL
    WHERE campaign_id = ${campaignId} AND subscriber_id = (SELECT subscriber_id FROM candidate)
      AND status = 'pending'
    RETURNING subscriber_id`;
    if (claimed.length === 0) break;
    const subscriberId = String(claimed[0].subscriber_id);
    const token = subscriberUnsubscribeToken(
      subscriberId,
      config.unsubscribeSecret,
    );
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
    const unsubscribeUrl = new URL(
      '/api/newsletter/unsubscribe',
      NEWSLETTER_PRIVACY_URL,
    );
    unsubscribeUrl.searchParams.set('token', token);
    const rendered = renderNewsletterEmail({
      ...config.presentation,
      articleId: campaign.article_slug,
      title: campaign.subject,
      markdown,
      privacyUrl: NEWSLETTER_PRIVACY_URL,
      unsubscribeUrl: unsubscribeUrl.toString(),
    });
    let messageId: string;
    try {
      attempted += 1;
      const result = await send(
        new SendEmailCommand({
          FromEmailAddress: NEWSLETTER_FROM,
          ReplyToAddresses: [NEWSLETTER_REPLY_TO],
          Destination: {
            ToAddresses: [String(subscribers[0].email_normalized)],
          },
          ConfigurationSetName: config.configurationSet,
          Content: {
            Simple: {
              Subject: { Data: campaign.subject, Charset: 'UTF-8' },
              Body: {
                Html: { Data: rendered.html, Charset: 'UTF-8' },
                Text: { Data: rendered.text, Charset: 'UTF-8' },
              },
              Headers: Object.entries(rendered.headers).map(
                ([Name, Value]) => ({ Name, Value }),
              ),
            },
          },
        }),
      );
      if (!result.MessageId)
        throw new Error(
          'SES accepted the request without returning a message id.',
        );
      messageId = result.MessageId;
    } catch {
      console.error(
        'Send outcome is indeterminate; the recipient remains in sending state and will not be retried automatically.',
      );
      throw new Error(
        'Delivery stopped; inspect campaign status and reconcile manually.',
      );
    }
    sent += 1;

    try {
      const recorded = await db`WITH finalized AS (
        UPDATE campaign_recipients SET status = 'sent', provider_message_id = ${messageId}, sent_at = now()
        WHERE campaign_id = ${campaignId} AND subscriber_id = ${subscriberId} AND status = 'sending'
        RETURNING subscriber_id
      )
      UPDATE campaigns SET batch_accepted = batch_accepted + 1
      WHERE id = ${campaignId} AND status = 'sending' AND batch_id = ${batchId}
        AND EXISTS (SELECT 1 FROM finalized)
      RETURNING id`;
      if (recorded.length !== 1)
        throw new Error(
          'The claimed campaign recipient could not be finalized.',
        );
      await reconcileSesMessage(messageId, db);
    } catch {
      console.error(
        'SES accepted the message, but database finalization is incomplete. Do not rerun; reconcile manually.',
      );
      throw new Error(
        'Delivery stopped; inspect campaign status and reconcile manually.',
      );
    }
    const pending =
      await db`SELECT count(*)::int AS count FROM campaign_recipients WHERE campaign_id = ${campaignId} AND status = 'pending'`;
    progress({
      accepted: sent,
      attempted,
      skipped,
      pending: Number(pending[0]?.count ?? 0),
    });
    await wait(delayMs);
  }

  // Terminalize suppressed pending rows before deciding whether work remains.
  const suppressed = await db`WITH suppressed AS (
    UPDATE campaign_recipients SET status = 'failed', error_detail = 'suppressed before send'
    WHERE campaign_id = ${campaignId} AND status = 'pending'
      AND subscriber_id IN (SELECT id FROM subscribers WHERE status <> 'active')
    RETURNING 1
  )
  SELECT count(*)::int AS count FROM suppressed`;
  skipped += Number(suppressed[0]?.count ?? 0);
  const finished = await db`UPDATE campaigns SET
    status = CASE WHEN EXISTS (SELECT 1 FROM campaign_recipients WHERE campaign_id = ${campaignId} AND status = 'pending')
      THEN 'paused' ELSE 'completed' END,
    completed_at = CASE WHEN NOT EXISTS (SELECT 1 FROM campaign_recipients WHERE campaign_id = ${campaignId} AND status = 'pending')
      THEN now() ELSE NULL END,
    batch_finished_at = now()
    WHERE id = ${campaignId} AND status = 'sending' AND batch_id = ${batchId}
      AND NOT EXISTS (SELECT 1 FROM campaign_recipients WHERE campaign_id = ${campaignId} AND status = 'sending')
    RETURNING status`;
  if (finished.length !== 1)
    throw new Error('Checkpoint incomplete; manual reconciliation required.');
  const remaining =
    await db`SELECT count(*)::int AS count FROM campaign_recipients WHERE campaign_id = ${campaignId} AND status = 'pending'`;
  return {
    campaignId,
    batchId,
    accepted: sent,
    attempted,
    skipped,
    pending: Number(remaining[0]?.count ?? 0),
    status: String(finished[0].status),
  };
}
