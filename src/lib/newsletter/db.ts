import { neon } from '@neondatabase/serverless';

function databaseUrl(): string {
  const value = process.env.DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED;
  if (!value) throw new Error('Newsletter database is not configured.');
  return value;
}

export function newsletterDb() {
  return neon(databaseUrl());
}
