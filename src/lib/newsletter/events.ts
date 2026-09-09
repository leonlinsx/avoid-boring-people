import { newsletterDb } from './db.ts';
import type { SnsEnvelope } from './sns.ts';

type SesRecipient = { emailAddress?: unknown };
type SesEvent = {
  eventType?: unknown;
  mail?: { messageId?: unknown; destination?: unknown };
  delivery?: { timestamp?: unknown };
  bounce?: { bounceType?: unknown; timestamp?: unknown; bouncedRecipients?: unknown };
  complaint?: { timestamp?: unknown; complainedRecipients?: unknown };
};

function isoDate(value: unknown): string | null {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : null;
}

function recipientEmails(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((recipient: SesRecipient) => typeof recipient?.emailAddress === 'string' ? [recipient.emailAddress.trim().toLowerCase()] : []);
}

function parseEvent(value: string): SesEvent {
  const event = JSON.parse(value) as SesEvent;
  if (!event || typeof event !== 'object' || typeof event.eventType !== 'string') throw new Error('SES event payload is invalid.');
  return event;
}

export async function recordSesEvent(envelope: SnsEnvelope, db = newsletterDb()): Promise<void> {
  const event = parseEvent(envelope.Message);
  const messageId = typeof event.mail?.messageId === 'string' ? event.mail.messageId : null;
  const status = !messageId ? null : event.eventType === 'Delivery' ? 'sent'
    : event.eventType === 'Bounce' && event.bounce?.bounceType === 'Permanent' ? 'bounced'
    : event.eventType === 'Complaint' ? 'complained' : null;
  const at = isoDate(status === 'sent' ? event.delivery?.timestamp
    : status === 'bounced' ? event.bounce?.timestamp : event.complaint?.timestamp);
  // Redacted complaint recipients must never fall back to mail.destination.
  const emails = recipientEmails(status === 'bounced' ? event.bounce?.bouncedRecipients
    : status === 'complained' ? event.complaint?.complainedRecipients : []);

  // One atomic statement: failed updates roll back the deduplication receipt too.
  // Every mutation depends on the newly inserted receipt, including concurrent retries.
  await db`WITH receipt AS (
    INSERT INTO newsletter_event_receipts (provider, event_id, provider_message_id, event_status, event_at)
    VALUES ('sns', ${envelope.MessageId}, ${messageId}, ${status}, ${at}::timestamptz)
    ON CONFLICT DO NOTHING RETURNING event_id
  ), recipients AS (
    UPDATE campaign_recipients SET
      status = CASE WHEN status IN ('bounced', 'complained') THEN status ELSE ${status} END,
      delivered_at = CASE WHEN ${status} = 'sent' THEN COALESCE(delivered_at, ${at}::timestamptz) ELSE delivered_at END,
      bounced_at = CASE WHEN ${status} = 'bounced' THEN COALESCE(bounced_at, ${at}::timestamptz) ELSE bounced_at END,
      complained_at = CASE WHEN ${status} = 'complained' THEN COALESCE(complained_at, ${at}::timestamptz) ELSE complained_at END,
      last_event_at = now()
    WHERE provider_message_id = ${messageId} AND ${status}::text IS NOT NULL
      AND EXISTS (SELECT 1 FROM receipt)
    RETURNING subscriber_id
  )
  UPDATE subscribers SET status = (CASE WHEN ${status}::text IN ('bounced', 'complained') THEN ${status} ELSE NULL END)::newsletter_subscriber_status, updated_at = now()
    WHERE status = 'active' AND ${status}::text IN ('bounced', 'complained')
      AND (id IN (SELECT subscriber_id FROM recipients) OR email_normalized = ANY(${emails}::text[]))
      AND EXISTS (SELECT 1 FROM receipt)`;
}

export async function reconcileSesMessage(messageId: string, db = newsletterDb()): Promise<void> {
  await db`WITH event_state AS (
    SELECT CASE
        WHEN bool_or(event_status = 'complained') THEN 'complained'
        WHEN bool_or(event_status = 'bounced') THEN 'bounced'
        WHEN bool_or(event_status = 'sent') THEN 'sent'
        ELSE NULL
      END AS status,
      min(event_at) FILTER (WHERE event_status = 'sent') AS delivered_at,
      min(event_at) FILTER (WHERE event_status = 'bounced') AS bounced_at,
      min(event_at) FILTER (WHERE event_status = 'complained') AS complained_at
    FROM newsletter_event_receipts WHERE provider_message_id = ${messageId}
  ), recipients AS (
    UPDATE campaign_recipients SET
      status = CASE
        WHEN campaign_recipients.status = 'complained' OR event_state.status = 'complained' THEN 'complained'
        WHEN campaign_recipients.status = 'bounced' OR event_state.status = 'bounced' THEN 'bounced'
        WHEN event_state.status = 'sent' THEN 'sent'
        ELSE campaign_recipients.status
      END,
      delivered_at = COALESCE(campaign_recipients.delivered_at, event_state.delivered_at),
      bounced_at = COALESCE(campaign_recipients.bounced_at, event_state.bounced_at),
      complained_at = COALESCE(campaign_recipients.complained_at, event_state.complained_at),
      last_event_at = CASE WHEN event_state.status IS NULL THEN campaign_recipients.last_event_at ELSE now() END
    FROM event_state
    WHERE campaign_recipients.provider_message_id = ${messageId} AND event_state.status IS NOT NULL
    RETURNING campaign_recipients.subscriber_id, campaign_recipients.status
  )
  UPDATE subscribers SET status = recipients.status::newsletter_subscriber_status, updated_at = now()
  FROM recipients
  WHERE subscribers.id = recipients.subscriber_id AND subscribers.status = 'active'
    AND recipients.status IN ('bounced', 'complained')`;
}
