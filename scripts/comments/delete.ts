import { commentsDb } from '../../src/lib/comments/db.ts';
import { deleteCommentWithReplies } from '../../src/lib/comments/store.ts';
import { print, requireCommentId } from './cli.ts';

// Usage: npm run comments:delete -- <comment-id> --confirm-delete
// Permanently removes the comment; if it has replies, they are removed with it
// because a missing parent would leave them unreachable.
const id = requireCommentId(process.argv[2]);
if (!process.argv.includes('--confirm-delete')) {
  throw new Error(
    'Usage: npm run comments:delete -- <comment-id> --confirm-delete',
  );
}

const result = await deleteCommentWithReplies(commentsDb(), id);
if (!result) throw new Error('Comment was not found. Nothing was deleted.');

// The removed rows are echoed because this step is irreversible: an operator who
// mistyped an id can at least see what was destroyed and re-post it.
const EXCERPT_LENGTH = 120;
const excerpt = (body: string | null): string | null => {
  if (body === null) return null;
  return body.length > EXCERPT_LENGTH
    ? `${body.slice(0, EXCERPT_LENGTH)}…`
    : body;
};

print({
  id,
  deleted: result.deleted,
  removedReplies: result.removedReplies,
  removed: result.removed.map((row) => ({
    id: row.id,
    slug: row.post_slug,
    parentId: row.parent_id,
    authorName: row.author_name,
    body: excerpt(row.body),
  })),
});
