import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';
import { neonDb } from '../neon.ts';
import { normalizeEmail } from './domain.ts';
import { createToken, hashToken } from './tokens.ts';
import {
  EMAIL_ATTEMPTS_PER_HOUR,
  IP_ATTEMPTS_PER_HOUR,
  takeRateLimit,
} from './rate-limit.ts';
import { NEWSLETTER_FROM, NEWSLETTER_REPLY_TO } from './email.ts';
import { normalizeAttribution, type AttributionInput } from './attribution.ts';

// The one answer every signup request gets, whatever the request did. It never
// reveals whether the address is known, suppressed, or newly created.
export const genericSubscriptionResponse = {
  ok: true,
  message: 'If this address can receive this newsletter, check your inbox.',
};

export const CONFIRMATION_SUBJECT =
  'Confirm your subscription to Avoid Boring People';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

// Small purpose-specific confirmation renderer. Not part of the article
// newsletter renderer: plain single-column HTML plus a plain-text alternative,
// no images, no tracking, only direct leonlins.com links.
export function buildConfirmationEmail(confirmUrl: string): {
  html: string;
  text: string;
} {
  const url = escapeHtml(confirmUrl);
  const html =
    `<div style="font-family: Georgia, 'Times New Roman', serif; line-height: 1.6; color: #222222; max-width: 560px; margin: 0 auto; padding: 24px 16px;">` +
    `<h1 style="font-size: 22px; font-weight: bold; margin: 0 0 16px;">Confirm your subscription</h1>` +
    `<p style="margin: 0 0 12px;">Thanks for subscribing to Avoid Boring People.</p>` +
    `<p style="margin: 0 0 20px;">Please confirm your email address to receive new essays from me on investing, technology, systems, and whatever else I’m exploring.</p>` +
    `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 0 20px;"><tr>` +
    `<td bgcolor="#1a1a1a" style="border-radius: 4px; background-color: #1a1a1a;">` +
    `<a href="${url}" style="display: inline-block; padding: 12px 24px; font-family: Arial, Helvetica, sans-serif; font-size: 16px; color: #ffffff; text-decoration: none;">Confirm my subscription</a>` +
    `</td></tr></table>` +
    `<p style="margin: 0 0 12px;">If you didn’t subscribe, you can ignore this email.</p>` +
    `<p style="margin: 24px 0 0;">— Leon<br>leonlins.com</p>` +
    `</div>`;
  const text = `Confirm your subscription\n\nThanks for subscribing to Avoid Boring People.\n\nPlease confirm your email address to receive new essays from me on investing, technology, systems, and whatever else I’m exploring.\n${confirmUrl}\n\nIf you didn’t subscribe, you can ignore this email.\n\n— Leon\nleonlins.com`;
  return { html, text };
}

function siteOrigin(): string {
  return process.env.SITE_URL ?? 'https://leonlins.com';
}

function testRecipients(): Set<string> {
  return new Set(
    (process.env.NEWSLETTER_TEST_RECIPIENTS ?? '')
      .split(',')
      .map(normalizeEmail)
      .filter(Boolean) as string[],
  );
}

export function canDeliverConfirmation(email: string): boolean {
  if (process.env.NEWSLETTER_CONFIRMATION_DELIVERY_ENABLED !== 'true')
    return false;
  return (
    process.env.NEWSLETTER_CONFIRMATION_PRODUCTION_ENABLED === 'true' ||
    testRecipients().has(email)
  );
}

async function sendConfirmation(email: string, token: string) {
  if (!canDeliverConfirmation(email)) {
    console.info('newsletter_confirmation_skipped');
    return;
  }

  const configurationSet = process.env.SES_CONFIGURATION_SET;

  if (!configurationSet) {
    console.error('newsletter_confirmation_configuration_error', {
      message: 'SES configuration set is not configured.',
    });

    throw new Error('SES configuration set is not configured.');
  }

  const url = new URL('/api/newsletter/confirm', siteOrigin());
  url.searchParams.set('token', token);
  const bodies = buildConfirmationEmail(url.toString());

  console.info('newsletter_confirmation_send_attempt', {
    region: process.env.AWS_REGION ?? 'undefined',
    hasConfigurationSet: true,
  });

  try {
    const result = await new SESv2Client({
      region: process.env.AWS_REGION,
    }).send(
      new SendEmailCommand({
        FromEmailAddress: NEWSLETTER_FROM,
        ReplyToAddresses: [NEWSLETTER_REPLY_TO],
        Destination: {
          ToAddresses: [email],
        },
        ConfigurationSetName: configurationSet,
        Content: {
          Simple: {
            Subject: {
              Data: CONFIRMATION_SUBJECT,
            },
            Body: {
              Text: {
                Data: bodies.text,
              },
              Html: {
                Data: bodies.html,
              },
            },
          },
        },
      }),
    );

    console.info('newsletter_confirmation_send_success', {
      messageId: result.MessageId,
    });
  } catch (error) {
    console.error('newsletter_confirmation_send_failure', {
      name: error instanceof Error ? error.name : 'unknown',
      message: error instanceof Error ? error.message : 'unknown',
    });

    throw error;
  }
}

export async function requestSubscription(
  input: {
    email: string;
    source?: string;
    honeypot?: string;
    ip?: string;
    attribution?: AttributionInput | null;
  },
  db = neonDb('Newsletter'),
) {
  const email = normalizeEmail(input.email);
  if (!email || input.honeypot) return genericSubscriptionResponse;
  const [emailAllowed, ipAllowed] = await Promise.all([
    takeRateLimit('email', email, EMAIL_ATTEMPTS_PER_HOUR, db),
    takeRateLimit('ip', input.ip ?? 'unknown', IP_ATTEMPTS_PER_HOUR, db),
  ]);
  if (!emailAllowed || !ipAllowed) return genericSubscriptionResponse;
  const rows =
    await db`SELECT status FROM subscribers WHERE email_normalized = ${email}`;
  const status = rows[0]?.status as string | undefined;
  // A bounce or a complaint is a deliverability fact, not a preference, so those
  // rows are never reopened by a form post. An unsubscribe is a preference and
  // can be reversed, but only by the same double opt-in that created the
  // subscription: the row is reissued a confirmation token and keeps its
  // suppressed status until the reader confirms it.
  if (status === 'active' || status === 'bounced' || status === 'complained')
    return genericSubscriptionResponse;
  const token = createToken();
  const unsubscribeToken = createToken();
  const source = (input.source ?? 'website').slice(0, 100);
  const attribution = input.attribution
    ? normalizeAttribution(input.attribution)
    : null;
  // Attribution is first-touch: it is recorded when the subscriber row is
  // first created and deliberately left untouched by the conflict branch, so a
  // later resubmission cannot overwrite how the subscriber was originally
  // acquired. `source_detail` keeps the signup form variant, and the row's own
  // `created_at` is when the attribution was recorded.
  //
  // The conflict branch refreshes the confirmation token for a pending row and
  // for an unsubscribed row — the latter is how an explicit resubscription
  // starts — and never changes status, so a row stays suppressed until the
  // confirmation step below activates it.
  await db`INSERT INTO subscribers (
      email, email_normalized, status, source, source_detail,
      confirmation_token_hash, unsubscribe_token_hash, consent_provenance,
      acquisition_source, acquisition_detail, utm_source, utm_medium,
      utm_campaign, utm_content, signup_path, referrer_domain
    )
    VALUES (
      ${email}, ${email}, 'pending', 'website', ${source},
      ${hashToken(token)}, ${hashToken(unsubscribeToken)}, 'website_double_opt_in',
      ${attribution?.source ?? null}, ${attribution?.detail ?? null},
      ${attribution?.utmSource ?? null}, ${attribution?.utmMedium ?? null},
      ${attribution?.utmCampaign ?? null}, ${attribution?.utmContent ?? null},
      ${attribution?.signupPath ?? null}, ${attribution?.referrerDomain ?? null}
    )
    ON CONFLICT (email_normalized) DO UPDATE SET confirmation_token_hash = EXCLUDED.confirmation_token_hash, updated_at = now()
    WHERE subscribers.status IN ('pending', 'unsubscribed')`;
  await sendConfirmation(email, token);
  return genericSubscriptionResponse;
}

export async function confirmSubscription(
  token: string,
  db = neonDb('Newsletter'),
) {
  if (!token) return false;
  // A first confirmation and a resubscription both arrive here: a pending row
  // becomes active, and an unsubscribed row that asked for a fresh token becomes
  // active again. `confirmed_at` keeps its first value, so a resubscription
  // reads as a return rather than as a new subscriber. `unsubscribed_at` is left
  // alone: it records the last cancellation, which the report counts in the
  // window where it actually happened.
  const rows =
    await db`UPDATE subscribers SET status = 'active', confirmed_at = COALESCE(confirmed_at, now()), confirmation_token_hash = NULL, updated_at = now()
    WHERE status IN ('pending', 'unsubscribed') AND confirmation_token_hash = ${hashToken(token)} RETURNING id`;
  return rows.length > 0;
}

export async function unsubscribe(token: string, db = neonDb('Newsletter')) {
  if (!token) return false;
  // `now()` applies only to a row that is still live, so a cancellation after an
  // explicit resubscription records its own time while a repeated click on an
  // already unsubscribed row keeps the time it already had. The confirmation
  // token is cleared either way, because a suppressed row must not keep a live
  // credential that a confirmation email from an earlier request could still use
  // to reopen it.
  await db`UPDATE subscribers SET status = 'unsubscribed', unsubscribed_at = CASE WHEN status = 'unsubscribed' THEN unsubscribed_at ELSE now() END, confirmation_token_hash = NULL, updated_at = now()
    WHERE unsubscribe_token_hash = ${hashToken(token)} AND status IN ('pending', 'active', 'unsubscribed')`;
  return true;
}
