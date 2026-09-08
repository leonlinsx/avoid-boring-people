import { createHash } from 'node:crypto';
import { newsletterDb } from './db.ts';

export const EMAIL_ATTEMPTS_PER_HOUR = 5;
export const IP_ATTEMPTS_PER_HOUR = 20;

export function hashRateLimitSubject(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function isRateLimitAllowed(attemptCount: number, limit: number): boolean {
  return attemptCount <= limit;
}

export async function takeRateLimit(scope: 'ip' | 'email', subject: string, limit: number): Promise<boolean> {
  const db = newsletterDb();
  const rows = await db`INSERT INTO newsletter_rate_limits (scope, subject, window_started_at, attempt_count)
    VALUES (${scope}, ${hashRateLimitSubject(subject)}, now(), 1)
    ON CONFLICT (scope, subject) DO UPDATE SET
      window_started_at = CASE WHEN newsletter_rate_limits.window_started_at < now() - interval '1 hour' THEN now() ELSE newsletter_rate_limits.window_started_at END,
      attempt_count = CASE WHEN newsletter_rate_limits.window_started_at < now() - interval '1 hour' THEN 1 ELSE newsletter_rate_limits.attempt_count + 1 END
    RETURNING attempt_count`;
  return isRateLimitAllowed(Number(rows[0]?.attempt_count), limit);
}
