import type { NeonDb } from '../neon.ts';

export type StoredContactNote = {
  id: string;
  /** ISO timestamp of the insert, as the database recorded it. */
  createdAt: string;
};

// This is a circuit breaker, not a measure of reader identity. Twenty-five
// accepted notes in one hour is far above normal inbound while keeping a
// bypassed Turnstile from creating unbounded writes and notifications.
export const MAX_CONTACT_SUBMISSIONS_PER_HOUR = 25;

const CONTACT_RATE_LIMIT_LOCK_NAMESPACE = 1668247156;

// The inserted row is the durable record of the note. Delivery happens after it,
// so a failed notification leaves evidence behind instead of losing what someone
// wrote.
export async function createContactSubmission(
  db: NeonDb,
  input: {
    name: string;
    email: string;
    message: string;
    sourcePage: string;
  },
): Promise<StoredContactNote> {
  const rows = (await db`
    INSERT INTO contact_submissions (name, email, message, source_page)
    VALUES (${input.name}, ${input.email}, ${input.message}, ${input.sourcePage})
    RETURNING id, created_at`) as Array<{
    id: string;
    created_at: string | Date;
  }>;

  const row = rows[0];
  if (!row) throw new Error('Contact submission was not stored.');
  return { id: row.id, createdAt: toIso(row.created_at) };
}

// The transaction lock makes the count-and-insert decision global even when
// several serverless requests arrive together. It carries no reader identity
// and disappears at commit; the existing submission rows remain the only state.
export async function createContactSubmissionWithinLimit(
  db: NeonDb,
  input: {
    name: string;
    email: string;
    message: string;
    sourcePage: string;
  },
): Promise<StoredContactNote | null> {
  const [, rows] = (await db.transaction((tx) => [
    tx`SELECT pg_advisory_xact_lock(${CONTACT_RATE_LIMIT_LOCK_NAMESPACE})`,
    tx`
      INSERT INTO contact_submissions (name, email, message, source_page)
      SELECT ${input.name}, ${input.email}, ${input.message}, ${input.sourcePage}
      WHERE (
        SELECT count(*)
        FROM contact_submissions
        WHERE created_at >= now() - INTERVAL '1 hour'
      ) < ${MAX_CONTACT_SUBMISSIONS_PER_HOUR}
      RETURNING id, created_at`,
  ])) as [unknown[], Array<{ id: string; created_at: string | Date }>];

  const row = rows[0];
  return row ? { id: row.id, createdAt: toIso(row.created_at) } : null;
}

// Neon hands timestamps back as either a `Date` or a string depending on the
// transport, so the one conversion lives here. An unparseable value stays empty
// rather than being replaced with a plausible-looking time.
function toIso(value: string | Date): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

// Written as soon as SES accepted the mail, and deliberately before the optional
// handoff runs: once the notification went out the note is delivered, so a slow
// or abandoned handoff must never leave it looking like a note nobody was told
// about. A row without this timestamp is the operator's inbox.
export async function markContactNotified(
  db: NeonDb,
  id: string,
): Promise<void> {
  await db`
    UPDATE contact_submissions
    SET notified_at = now()
    WHERE id = ${id}::uuid AND notified_at IS NULL`;
}

// The handoff is optional and best-effort, so its timestamp is only recorded when
// a handoff actually happened. A failed or skipped one is reported by the
// `lin_check_failure` alert line instead, which keeps "not configured yet"
// distinguishable from "Lin Check is refusing notes".
export async function markContactLinCheckSynced(
  db: NeonDb,
  id: string,
): Promise<void> {
  await db`
    UPDATE contact_submissions
    SET lin_check_synced_at = now()
    WHERE id = ${id}::uuid AND lin_check_synced_at IS NULL`;
}
