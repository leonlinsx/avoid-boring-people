// Shared test harness: repository paths, captured log output, and fake database adapters.

import assert from 'node:assert/strict';
import path from 'node:path';
import { BLOG_CONTENT_DIR } from '../../src/utils/article-routes.ts';

export const REPO_ROOT = path.resolve(BLOG_CONTENT_DIR, '../../..');

export async function withCapturedLogs(
  run: () => Promise<void>,
): Promise<unknown[][]> {
  const calls: unknown[][] = [];
  const originalError = console.error;
  const originalWarn = console.warn;
  console.error = (...args: unknown[]) => {
    calls.push(args);
  };
  console.warn = (...args: unknown[]) => {
    calls.push(args);
  };
  try {
    await run();
  } finally {
    console.error = originalError;
    console.warn = originalWarn;
  }
  return calls;
}

export function makeFakeDb(
  handler: (query: { text: string; values: unknown[] }) => unknown[],
) {
  const queries: Array<{ text: string; values: unknown[] }> = [];
  const db: any = async (parts: TemplateStringsArray, ...values: unknown[]) => {
    const query = { text: parts.join(' {?} '), values };
    queries.push(query);
    return handler(query);
  };
  return { db, queries };
}

/** A fake database that fails the test if the handler reaches the database. */
export function makeForbiddenDb() {
  return makeFakeDb(() => {
    throw new Error('the handler must not query the database for this request');
  });
}

/** The single recorded query whose SQL matches `pattern`. */
export function soleQuery(
  queries: Array<{ text: string; values: unknown[] }>,
  pattern: RegExp,
): { text: string; values: unknown[] } {
  const matches = queries.filter((query) => pattern.test(query.text));
  assert.equal(
    matches.length,
    1,
    `expected exactly one query matching ${pattern}`,
  );
  const [match] = matches;
  assert.ok(match);
  return match;
}

export const verifiedTurnstileFetch = (async () =>
  new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })) as unknown as typeof fetch;
