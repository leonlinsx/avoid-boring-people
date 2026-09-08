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

async function updateCampaignRecipients(messageId: string, status: 'sent' | 'bounced' | 'complained', column: 'delivered_at' | 'bounced_at' | 'complained_at', at: string | null) {
  const db = newsletterDb();
  if (column === 'delivered_at') {
    await db`UPDATE campaign_recipients SET status = ${status}, delivered_at = COALESCE(${at}::timestamptz, delivered_at), last_event_at = now()
      WHERE provider_message_id = ${messageId}`;
  } else if (column === 'bounced_at') {
    await db`UPDATE campaign_recipients SET status = ${status}, bounced_at = COALESCE(${at}::timestamptz, bounced_at), last_event_at = now()
      WHERE provider_message_id = ${messageId}`;
  } else {
    await db`UPDATE campaign_recipients SET status = ${status}, complained_at = COALESCE(${at}::timestamptz, complained_at), last_event_at = now()
      WHERE provider_message_id = ${messageId}`;
  }
}

async function suppressActiveSubscribers(emails: string[], status: 'bounced' | 'complained') {
  if (!emails.length) return;
  const db = newsletterDb();
  await db`UPDATE subscribers SET status = ${status}, updated_at = now()
    WHERE status = 'active' AND email_normalized = ANY(${emails})`;
}

export async function recordSesEvent(envelope: SnsEnvelope): Promise<void> {
  const event = parseEvent(envelope.Message);
  const db = newsletterDb();
  const receipt = await db`INSERT INTO newsletter_event_receipts (provider, event_id) VALUES ('sns', ${envelope.MessageId})
    ON CONFLICT DO NOTHING RETURNING event_id`;
  if (!receipt.length) return;

  const messageId = typeof event.mail?.messageId === 'string' ? event.mail.messageId : null;
  if (!messageId) return;
  if (event.eventType === 'Delivery') {
    await updateCampaignRecipients(messageId, 'sent', 'delivered_at', isoDate(event.delivery?.timestamp));
    return;
  }
  if (event.eventType === 'Bounce' && event.bounce?.bounceType === 'Permanent') {
    const emails = recipientEmails(event.bounce.bouncedRecipients);
    await updateCampaignRecipients(messageId, 'bounced', 'bounced_at', isoDate(event.bounce.timestamp));
    await suppressActiveSubscribers(emails, 'bounced');
    return;
  }
  if (event.eventType === 'Complaint') {
    // SES may redact complaint recipients. An absent address is deliberately a no-op.
    const emails = recipientEmails(event.complaint?.complainedRecipients);
    await updateCampaignRecipients(messageId, 'complained', 'complained_at', isoDate(event.complaint?.timestamp));
    await suppressActiveSubscribers(emails, 'complained');
  }
}
