import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';
import { NEWSLETTER_FROM } from '../newsletter/email.ts';
import { CONTACT_EMAIL, UNKNOWN_SOURCE_PAGE } from './domain.ts';

// A notification that never comes back must not hold the request open: the note
// is already stored, and a bounded send turns a stalled connection into the
// visible `notification_failure` path instead of a hung request nobody sees.
export const NOTIFICATION_TIMEOUT_MS = 5_000;

export type ContactNotification = {
  id: string;
  name: string;
  email: string;
  message: string;
  sourcePage: string;
  /** ISO timestamp, decided at insert time so the mail and the row agree. */
  receivedAt: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

// The name is already whitespace-collapsed and free of control characters, so it
// cannot break the header it lands in. The subject stays ASCII: it is the one
// field that still passes through providers that mishandle encoded words.
export function contactNotificationSubject(
  note: Pick<ContactNotification, 'name' | 'sourcePage'>,
): string {
  const from =
    note.sourcePage && note.sourcePage !== UNKNOWN_SOURCE_PAGE
      ? ` - ${note.sourcePage}`
      : '';
  return `New note from ${note.name}${from}`;
}

// Small purpose-specific renderer, in the same spirit as the newsletter's
// confirmation mail: plain single-column HTML plus a plain-text alternative, no
// images, and no tracking. The message is escaped and pre-wrapped, because it is
// prose someone else wrote.
export function buildContactNotification(note: ContactNotification): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = contactNotificationSubject(note);
  const text = [
    `Name: ${note.name}`,
    `Email: ${note.email}`,
    `Page: ${note.sourcePage}`,
    `Received: ${note.receivedAt}`,
    '',
    note.message,
    '',
    `Reply to this email to answer ${note.name} directly.`,
  ].join('\n');

  const html =
    `<div style="font-family: Georgia, 'Times New Roman', serif; line-height: 1.6; color: #222222; max-width: 560px; margin: 0 auto; padding: 24px 16px;">` +
    `<h1 style="font-size: 20px; margin: 0 0 16px;">A note from the site</h1>` +
    `<p style="margin: 0 0 4px;"><strong>Name:</strong> ${escapeHtml(note.name)}</p>` +
    `<p style="margin: 0 0 4px;"><strong>Email:</strong> ${escapeHtml(note.email)}</p>` +
    `<p style="margin: 0 0 4px;"><strong>Page:</strong> ${escapeHtml(note.sourcePage)}</p>` +
    `<p style="margin: 0 0 16px;"><strong>Received:</strong> ${escapeHtml(note.receivedAt)}</p>` +
    `<div style="white-space: pre-wrap; border-top: 1px solid #dddddd; padding-top: 16px;">${escapeHtml(note.message)}</div>` +
    `<p style="margin: 24px 0 0; font-size: 13px; color: #555555;">Reply to this email to answer directly.</p>` +
    `</div>`;

  return { subject, text, html };
}

// Sent from the site's one verified SES identity, with the submitter in
// Reply-To, so answering the notification answers the person who wrote in.
//
// No configuration set is attached, unlike the newsletter's subscriber mail:
// the SES/SNS events that a configuration set publishes are reconciled against
// campaign recipients and subscriber addresses, and a reply-to-author
// notification is not subscriber mail. Leaving it out keeps this mail out of the
// lifecycle pipeline rather than feeding it events it cannot place.
export async function sendContactNotification(
  note: ContactNotification,
  options: {
    client?: {
      send: (command: unknown, options?: unknown) => Promise<unknown>;
    };
  } = {},
): Promise<void> {
  const region = process.env.AWS_REGION;
  if (!region && !options.client)
    throw new Error('AWS region is not configured.');

  const bodies = buildContactNotification(note);
  const client =
    options.client ?? new SESv2Client({ region: process.env.AWS_REGION });

  await client.send(
    new SendEmailCommand({
      FromEmailAddress: NEWSLETTER_FROM,
      ReplyToAddresses: [note.email],
      Destination: { ToAddresses: [CONTACT_EMAIL] },
      Content: {
        Simple: {
          Subject: { Data: bodies.subject },
          Body: {
            Text: { Data: bodies.text },
            Html: { Data: bodies.html },
          },
        },
      },
    }),
    // The send is bounded so a stalled connection cannot outlive the reader's own
    // fifteen-second wait while the stored note sits unrecorded. Within that
    // bound the SDK may still retry, which can only duplicate the notification in
    // the author's own inbox: the stored row, not the mail, is the record.
    { abortSignal: AbortSignal.timeout(NOTIFICATION_TIMEOUT_MS) },
  );
}
