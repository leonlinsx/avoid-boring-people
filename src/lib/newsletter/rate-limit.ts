import { createHash } from 'node:crypto';
import { neonDb } from '../neon.ts';

export const EMAIL_ATTEMPTS_PER_HOUR = 5;
export const IP_ATTEMPTS_PER_HOUR = 20;

export function hashRateLimitSubject(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function isRateLimitAllowed(
  attemptCount: number,
  limit: number,
): boolean {
  return attemptCount <= limit;
}

export async function takeRateLimit(
  scope: 'ip' | 'email',
  subject: string,
  limit: number,
  db = neonDb('Newsletter'),
): Promise<boolean> {
  const rows = await db`WITH expired AS (
      SELECT scope, subject FROM newsletter_rate_limits
      WHERE window_started_at < now() - interval '1 hour'
        AND NOT (scope = ${scope} AND subject = ${hashRateLimitSubject(subject)})
      ORDER BY window_started_at LIMIT 100 FOR UPDATE SKIP LOCKED
    ), cleanup AS (
      DELETE FROM newsletter_rate_limits USING expired
      WHERE newsletter_rate_limits.scope = expired.scope
        AND newsletter_rate_limits.subject = expired.subject
    )
    INSERT INTO newsletter_rate_limits (scope, subject, window_started_at, attempt_count)
    VALUES (${scope}, ${hashRateLimitSubject(subject)}, now(), 1)
    ON CONFLICT (scope, subject) DO UPDATE SET
      window_started_at = CASE WHEN newsletter_rate_limits.window_started_at < now() - interval '1 hour' THEN now() ELSE newsletter_rate_limits.window_started_at END,
      attempt_count = CASE WHEN newsletter_rate_limits.window_started_at < now() - interval '1 hour' THEN 1 ELSE LEAST(newsletter_rate_limits.attempt_count + 1, ${limit + 1}) END
    RETURNING attempt_count`;
  return isRateLimitAllowed(Number(rows[0]?.attempt_count), limit);
}
