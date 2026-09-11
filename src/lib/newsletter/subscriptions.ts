import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';
import { newsletterDb } from './db.ts';
import { normalizeEmail } from './domain.ts';
import { createToken, hashToken } from './tokens.ts';
import { EMAIL_ATTEMPTS_PER_HOUR, IP_ATTEMPTS_PER_HOUR, takeRateLimit } from './rate-limit.ts';
import { NEWSLETTER_FROM, NEWSLETTER_REPLY_TO } from './email.ts';

const generic = { ok: true, message: 'If this address can receive this newsletter, check your inbox.' };

export const CONFIRMATION_SUBJECT = 'Confirm your subscription to Avoid Boring People';

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

// Small purpose-specific confirmation renderer. Not part of the article
// newsletter renderer: plain single-column HTML plus a plain-text alternative,
// no images, no tracking, only direct leonlins.com links.
export function buildConfirmationEmail(confirmUrl: string): { html: string; text: string } {
  const url = escapeHtml(confirmUrl);
  const html = `<div style="font-family: Georgia, 'Times New Roman', serif; line-height: 1.6; color: #222222; max-width: 560px; margin: 0 auto; padding: 24px 16px;">`
    + `<h1 style="font-size: 22px; font-weight: bold; margin: 0 0 16px;">Confirm your subscription</h1>`
    + `<p style="margin: 0 0 12px;">Thanks for subscribing to Avoid Boring People.</p>`
    + `<p style="margin: 0 0 20px;">Please confirm your email address to receive new essays from me on investing, technology, systems, and whatever else I’m exploring.</p>`
    + `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 0 20px;"><tr>`
    + `<td bgcolor="#1a1a1a" style="border-radius: 4px; background-color: #1a1a1a;">`
    + `<a href="${url}" style="display: inline-block; padding: 12px 24px; font-family: Arial, Helvetica, sans-serif; font-size: 16px; color: #ffffff; text-decoration: none;">Confirm my subscription</a>`
    + `</td></tr></table>`
    + `<p style="margin: 0 0 12px;">If you didn’t subscribe, you can ignore this email.</p>`
    + `<p style="margin: 24px 0 0;">— Leon<br>leonlins.com</p>`
    + `</div>`;
  const text = `Confirm your subscription\n\nThanks for subscribing to Avoid Boring People.\n\nPlease confirm your email address to receive new essays from me on investing, technology, systems, and whatever else I’m exploring.\n${confirmUrl}\n\nIf you didn’t subscribe, you can ignore this email.\n\n— Leon\nleonlins.com`;
  return { html, text };
}

function siteOrigin(): string {
  return process.env.SITE_URL ?? 'https://leonlins.com';
}

function testRecipients(): Set<string> {
  return new Set((process.env.NEWSLETTER_TEST_RECIPIENTS ?? '').split(',').map(normalizeEmail).filter(Boolean) as string[]);
}

export function canDeliverConfirmation(email: string): boolean {
  if (process.env.NEWSLETTER_CONFIRMATION_DELIVERY_ENABLED !== 'true') return false;
  return process.env.NEWSLETTER_CONFIRMATION_PRODUCTION_ENABLED === 'true' || testRecipients().has(email);
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

export async function requestSubscription(input: { email: string; source?: string; honeypot?: string; ip?: string }, db = newsletterDb()) {
  const email = normalizeEmail(input.email);
  if (!email || input.honeypot) return generic;
  const [emailAllowed, ipAllowed] = await Promise.all([
    takeRateLimit('email', email, EMAIL_ATTEMPTS_PER_HOUR, db),
    takeRateLimit('ip', input.ip ?? 'unknown', IP_ATTEMPTS_PER_HOUR, db),
  ]);
  if (!emailAllowed || !ipAllowed) return generic;
  const rows = await db`SELECT status FROM subscribers WHERE email_normalized = ${email}`;
  const status = rows[0]?.status as string | undefined;
  if (status === 'active' || status === 'unsubscribed' || status === 'bounced' || status === 'complained') return generic;
  const token = createToken();
  const unsubscribeToken = createToken();
  const source = (input.source ?? 'website').slice(0, 100);
  await db`INSERT INTO subscribers (email, email_normalized, status, source, source_detail, confirmation_token_hash, unsubscribe_token_hash, consent_provenance)
    VALUES (${email}, ${email}, 'pending', 'website', ${source}, ${hashToken(token)}, ${hashToken(unsubscribeToken)}, 'website_double_opt_in')
    ON CONFLICT (email_normalized) DO UPDATE SET confirmation_token_hash = EXCLUDED.confirmation_token_hash, updated_at = now()
    WHERE subscribers.status = 'pending'`;
  await sendConfirmation(email, token);
  return generic;
}

export async function confirmSubscription(token: string, db = newsletterDb()) {
  if (!token) return false;
  const rows = await db`UPDATE subscribers SET status = 'active', confirmed_at = COALESCE(confirmed_at, now()), confirmation_token_hash = NULL, updated_at = now()
    WHERE status = 'pending' AND confirmation_token_hash = ${hashToken(token)} RETURNING id`;
  return rows.length > 0;
}

export async function unsubscribe(token: string, db = newsletterDb()) {
  if (!token) return false;
  await db`UPDATE subscribers SET status = 'unsubscribed', unsubscribed_at = COALESCE(unsubscribed_at, now()), updated_at = now()
    WHERE unsubscribe_token_hash = ${hashToken(token)} AND status IN ('pending', 'active')`;
  return true;
}
