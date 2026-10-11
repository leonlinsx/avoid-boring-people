import { neon } from '@neondatabase/serverless';
import { createHash } from 'node:crypto';

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

// Temporary pre-005 identity check. Only a successful database-backed GET
// calls this; the public response never carries diagnostic information.
export function logProductionDatabaseIdentity(response: Response): void {
  if (process.env.VERCEL_ENV !== 'production' || !response.ok) return;
  try {
    const url = new URL(connectionUrl('Database'));
    const hostname = url.hostname
      .toLowerCase()
      .replace(/\.$/, '')
      .replace(/-pooler(?=\.c-\d+\.[^.]+\.aws\.neon\.tech$)/, '');
    const database = decodeURIComponent(url.pathname.slice(1));
    if (!hostname || !database) return;
    console.info(
      createHash('sha256')
        .update(JSON.stringify([hostname, database]))
        .digest('hex'),
    );
  } catch {
    // A diagnostic failure must not expose a URL or change the route response.
  }
}
