import { neon } from '@neondatabase/serverless';

export type NeonDb = ReturnType<typeof neonDb>;

// One connection helper for every subsystem that stores state in Neon: the
// pooled URL first, with the unpooled one as the local-script fallback.
function connectionUrl(label: string): string {
  const url = process.env.DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED;
  if (!url) throw new Error(`${label} database is not configured.`);
  return url;
}

export function neonDb(label: string) {
  return neon(connectionUrl(label));
}

// A missing connection string must read as "temporarily unavailable" rather than
// a 500, because every on-demand route that reads it is optional to the static
// page it belongs to.
export function tryNeonDb(): NeonDb | null {
  try {
    return neon(connectionUrl('Database'));
  } catch {
    return null;
  }
}
