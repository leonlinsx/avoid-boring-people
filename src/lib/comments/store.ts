import type { NeonDb } from '../neon.ts';
import {
  EDIT_WINDOW_INTERVAL,
  RATE_LIMIT_WINDOW_INTERVAL,
  type CommentRow,
} from './domain.ts';

// The edit window is expressed as an interval constant rather than an
// interpolated number so Postgres, not the application clock, decides whether a
// write is still allowed.
export type CreateCommentInput = {
  slug: string;
  parentId: string | null;
  tokenHash: string;
  name: string;
  body: string;
};

export type OwnCommentTarget = {
  id: string;
  slug: string;
  tokenHash: string;
};

export async function listPublishedComments(
  db: NeonDb,
  slug: string,
  tokenHash: string | null,
): Promise<CommentRow[]> {
  // Replies are only listed while their parent is still published, so hiding a
  // comment removes its thread instead of leaving replies orphaned on the page.
  // Ownership is decided in SQL and only ever exposed as a boolean: the token
  // hash is never returned to a client.
  return (await db`
    SELECT id, parent_id, author_name, body, is_author, created_at, updated_at,
      (NOT is_author AND author_token_hash IS NOT NULL AND author_token_hash = ${tokenHash ?? ''}
        AND created_at > now() - ${EDIT_WINDOW_INTERVAL}::interval) AS can_edit
    FROM comments
    WHERE post_slug = ${slug}
      AND status = 'published'
      AND (
        parent_id IS NULL
        OR EXISTS (
          SELECT 1 FROM comments parent
          WHERE parent.id = comments.parent_id AND parent.status = 'published'
        )
      )
    ORDER BY created_at ASC, id ASC`) as CommentRow[];
}

// Counted across every article for one browser identity, so the limit cannot be
// sidestepped by moving to another post. Hidden comments still count.
export async function countRecentComments(
  db: NeonDb,
  tokenHash: string,
): Promise<number> {
  const rows = (await db`
    SELECT count(*)::int AS recent
    FROM comments
    WHERE author_token_hash = ${tokenHash}
      AND created_at > now() - ${RATE_LIMIT_WINDOW_INTERVAL}::interval`) as Array<{
    recent: number | string;
  }>;
  return Number(rows[0]?.recent ?? 0);
}

// One statement for both top-level comments and replies: a reply is inserted
// only if its parent is a published top-level comment on the same article, which
// makes "reply to a reply" and cross-article replies impossible without a
// separate lookup that could race with the insert.
export async function createComment(
  db: NeonDb,
  input: CreateCommentInput,
): Promise<CommentRow | null> {
  const rows = (await db`
    INSERT INTO comments (
      post_slug, parent_id, author_token_hash, author_name, body, status, is_author
    )
    SELECT ${input.slug}, ${input.parentId}::uuid, ${input.tokenHash},
      ${input.name}, ${input.body}, 'published', FALSE
    WHERE ${input.parentId}::uuid IS NULL
      OR EXISTS (
        SELECT 1 FROM comments parent
        WHERE parent.id = ${input.parentId}::uuid
          AND parent.post_slug = ${input.slug}
          AND parent.parent_id IS NULL
          AND parent.status = 'published'
      )
    RETURNING id, parent_id, author_name, body, is_author, created_at, updated_at`) as CommentRow[];
  return rows[0] ?? null;
}

// Editing is limited to the comment text: the display name is what other readers
// already saw attached to the reply-level context, and the token hash is only
// reachable through the ownership check below.
export async function updateOwnCommentBody(
  db: NeonDb,
  target: OwnCommentTarget & { body: string },
): Promise<CommentRow | null> {
  const rows = (await db`
    UPDATE comments
    SET body = ${target.body}, updated_at = now()
    WHERE id = ${target.id}::uuid
      AND post_slug = ${target.slug}
      AND status = 'published'
      AND is_author = FALSE
      AND author_token_hash = ${target.tokenHash}
      AND created_at > now() - ${EDIT_WINDOW_INTERVAL}::interval
    RETURNING id, parent_id, author_name, body, is_author, created_at, updated_at`) as CommentRow[];
  return rows[0] ?? null;
}

export type DeleteOutcome = 'deleted' | 'placeholder' | 'unavailable';

// A comment with no replies is removed outright. A comment that has replies
// keeps a content-free placeholder row so other readers' replies stay attached
// to their thread, and the deleted comment's token hash is cleared so nothing
// can ever act on it again.
export async function deleteOwnComment(
  db: NeonDb,
  target: OwnCommentTarget,
): Promise<DeleteOutcome> {
  const deleted = (await db`
    DELETE FROM comments
    WHERE id = ${target.id}::uuid
      AND post_slug = ${target.slug}
      AND status = 'published'
      AND is_author = FALSE
      AND author_token_hash = ${target.tokenHash}
      AND created_at > now() - ${EDIT_WINDOW_INTERVAL}::interval
      AND NOT EXISTS (SELECT 1 FROM comments reply WHERE reply.parent_id = ${target.id}::uuid)
    RETURNING id`) as Array<{ id: string }>;
  if (deleted.length > 0) return 'deleted';

  const placeholders = (await db`
    UPDATE comments
    SET author_name = NULL, body = NULL, author_token_hash = NULL, updated_at = now()
    WHERE id = ${target.id}::uuid
      AND post_slug = ${target.slug}
      AND status = 'published'
      AND is_author = FALSE
      AND author_token_hash = ${target.tokenHash}
      AND created_at > now() - ${EDIT_WINDOW_INTERVAL}::interval
    RETURNING id`) as Array<{ id: string }>;
  return placeholders.length > 0 ? 'placeholder' : 'unavailable';
}

export type ModeratedComment = {
  id: string;
  post_slug: string;
  parent_id: string | null;
  author_name: string | null;
  body: string | null;
  status: string;
  is_author: boolean;
  has_owner: boolean;
  created_at: string | Date;
  updated_at: string | Date;
};

// Operator view: every comment the public cannot see, including hidden ones and
// rows whose owner identity is no longer stored.
export async function listCommentsForOperator(
  db: NeonDb,
  options: { slug?: string | null; includeHidden: boolean },
): Promise<ModeratedComment[]> {
  const slug = options.slug ?? null;
  return (await db`
    SELECT id, post_slug, parent_id, author_name, body, status, is_author,
      (author_token_hash IS NOT NULL) AS has_owner, created_at, updated_at
    FROM comments
    WHERE (${slug}::text IS NULL OR post_slug = ${slug}::text)
      AND (${options.includeHidden}::boolean OR status = 'published')
    ORDER BY created_at DESC, id DESC`) as ModeratedComment[];
}

export async function setCommentStatus(
  db: NeonDb,
  id: string,
  status: 'published' | 'hidden',
): Promise<boolean> {
  // updated_at tracks content changes only: moving it here would make a restored
  // comment look edited to readers.
  const rows = (await db`
    UPDATE comments
    SET status = ${status}
    WHERE id = ${id}::uuid
    RETURNING id`) as Array<{ id: string }>;
  return rows.length > 0;
}

export type RemovedComment = {
  id: string;
  post_slug: string;
  parent_id: string | null;
  author_name: string | null;
  body: string | null;
};

// The operator delete is deliberate and confirmed by the CLI. Replies are
// removed with their parent because a missing parent would leave them
// unreachable in the public discussion. The removed rows are returned so the
// CLI can report exactly what an irreversible step destroyed.
export async function deleteCommentWithReplies(
  db: NeonDb,
  id: string,
): Promise<{
  deleted: number;
  removedReplies: number;
  removed: RemovedComment[];
} | null> {
  const rows = (await db`
    DELETE FROM comments
    WHERE id = ${id}::uuid OR parent_id = ${id}::uuid
    RETURNING id, post_slug, parent_id, author_name, body`) as RemovedComment[];
  if (rows.length === 0) return null;
  const removedReplies = rows.filter(
    (row) => row.parent_id !== null && row.id !== id,
  ).length;
  return { deleted: rows.length, removedReplies, removed: rows };
}

export type AuthorReplyInput = {
  parentId: string;
  name: string;
  body: string;
};

// Author replies are written by the local operator CLI. They carry is_author and
// no owning token: the public API can never create or modify one.
export async function createAuthorReply(
  db: NeonDb,
  input: AuthorReplyInput,
): Promise<{ id: string; post_slug: string; parent_id: string } | null> {
  const rows = (await db`
    INSERT INTO comments (
      post_slug, parent_id, author_token_hash, author_name, body, status, is_author
    )
    SELECT parent.post_slug, parent.id, NULL, ${input.name}, ${input.body}, 'published', TRUE
    FROM comments parent
    WHERE parent.id = ${input.parentId}::uuid
      AND parent.parent_id IS NULL
      AND parent.status = 'published'
    RETURNING id, post_slug, parent_id`) as Array<{
    id: string;
    post_slug: string;
    parent_id: string;
  }>;
  return rows[0] ?? null;
}
