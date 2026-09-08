import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';
import { newsletterDb } from './db.ts';
import { normalizeEmail } from './domain.ts';
import { createToken, hashToken } from './tokens.ts';
import { EMAIL_ATTEMPTS_PER_HOUR, IP_ATTEMPTS_PER_HOUR, takeRateLimit } from './rate-limit.ts';

const generic = { ok: true, message: 'If this address can receive this newsletter, check your inbox.' };
const from = 'newsletter@leonlins.com';

function siteOrigin(): string {
  return process.env.SITE_URL ?? 'https://leonlins.com';
}

function testRecipients(): Set<string> {
  return new Set((process.env.NEWSLETTER_TEST_RECIPIENTS ?? '').split(',').map(normalizeEmail).filter(Boolean) as string[]);
}

async function sendConfirmation(email: string, token: string) {
  if (process.env.NEWSLETTER_CONFIRMATION_DELIVERY_ENABLED !== 'true' || !testRecipients().has(email)) return;
  const url = new URL('/api/newsletter/confirm', siteOrigin());
  url.searchParams.set('token', token);
  await new SESv2Client({ region: process.env.AWS_REGION }).send(new SendEmailCommand({
    FromEmailAddress: from,
    Destination: { ToAddresses: [email] },
    Content: { Simple: { Subject: { Data: 'Confirm your subscription' }, Body: { Text: { Data: `Confirm your subscription: ${url}` } } } },
  }));
}

export async function requestSubscription(input: { email: string; source?: string; honeypot?: string; ip?: string }) {
  const email = normalizeEmail(input.email);
  if (!email || input.honeypot) return generic;
  const [emailAllowed, ipAllowed] = await Promise.all([
    takeRateLimit('email', email, EMAIL_ATTEMPTS_PER_HOUR),
    takeRateLimit('ip', input.ip ?? 'unknown', IP_ATTEMPTS_PER_HOUR),
  ]);
  if (!emailAllowed || !ipAllowed) return generic;
  const db = newsletterDb();
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

export async function confirmSubscription(token: string) {
  if (!token) return false;
  const db = newsletterDb();
  const rows = await db`UPDATE subscribers SET status = 'active', confirmed_at = COALESCE(confirmed_at, now()), confirmation_token_hash = NULL, updated_at = now()
    WHERE status = 'pending' AND confirmation_token_hash = ${hashToken(token)} RETURNING id`;
  return rows.length > 0;
}

export async function unsubscribe(token: string) {
  if (!token) return false;
  const db = newsletterDb();
  await db`UPDATE subscribers SET status = 'unsubscribed', unsubscribed_at = COALESCE(unsubscribed_at, now()), updated_at = now()
    WHERE unsubscribe_token_hash = ${hashToken(token)} AND status IN ('pending', 'active')`;
  return true;
}
