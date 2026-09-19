import { neon } from '@neondatabase/serverless';

export type ContactDb = ReturnType<typeof contactDb>;

export function contactDb() {
  const url = process.env.DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED;
  if (!url) throw new Error('Contact database is not configured.');
  return neon(url);
}

// Notes are kept, so the table is not optional like the discussion's: a missing
// connection string has to read as "temporarily unavailable" rather than a 500,
// and the visitor is pointed at the email address instead.
export function tryContactDb(): ContactDb | null {
  try {
    return contactDb();
  } catch {
    return null;
  }
}
