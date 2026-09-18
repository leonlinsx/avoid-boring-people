import { neon } from '@neondatabase/serverless';

export type CommentDb = ReturnType<typeof commentsDb>;

export function commentsDb() {
  const url = process.env.DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED;
  if (!url) throw new Error('Comment database is not configured.');
  return neon(url);
}

// A missing database configuration must surface as "temporarily unavailable"
// rather than a 500, because the discussion is optional to the article.
export function tryCommentsDb(): CommentDb | null {
  try {
    return commentsDb();
  } catch {
    return null;
  }
}
