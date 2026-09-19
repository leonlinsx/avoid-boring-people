import { neonDb } from '../../src/lib/neon.ts';
import {
  COMMENT_AUTHOR_NAME,
  normalizeCommentId,
  normalizeCommentSlug,
  validateCommentInput,
} from '../../src/lib/comments/domain.ts';
import {
  createAuthorReply,
  deleteCommentWithReplies,
  listCommentsForOperator,
  setCommentStatus,
} from '../../src/lib/comments/store.ts';

// Local-only moderation and author CLI. Every status change and every author
// reply happens here, never through a public route, so there is no admin API and
// no browser-reachable moderation credential. Each subcommand keeps its own npm
// script, which is what the operator's command names depend on:
//
//   npm run comments:list    -- [--slug <article-slug>] [--include-hidden]
//   npm run comments:hide    -- <comment-id>
//   npm run comments:restore -- <comment-id>
//   npm run comments:delete  -- <comment-id> --confirm-delete
//   npm run comments:reply   -- --parent <comment-id> --body "<text>" --confirm-reply

const USAGE = `Usage: npm run comments:<command> -- [options]
Commands: list, hide, restore, delete, reply`;

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function requireCommentId(value: string | undefined): string {
  const id = normalizeCommentId(value ?? '');
  if (!id) throw new Error('A comment UUID is required.');
  return id;
}

function requireCommentSlug(value: string | undefined): string {
  const slug = normalizeCommentSlug(value ?? '');
  if (!slug) throw new Error('A valid article slug is required.');
  return slug;
}

function print(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

async function list(args: string[]): Promise<void> {
  const slugOption = option(args, '--slug');
  const slug = slugOption === undefined ? null : requireCommentSlug(slugOption);
  const includeHidden = args.includes('--include-hidden');

  const rows = await listCommentsForOperator(neonDb('Comment'), {
    slug,
    includeHidden,
  });
  print({
    slug,
    includeHidden,
    count: rows.length,
    comments: rows,
  });
}

async function hide(args: string[]): Promise<void> {
  const id = requireCommentId(args[0]);
  const changed = await setCommentStatus(neonDb('Comment'), id, 'hidden');
  if (!changed) throw new Error('Comment was not found. Nothing was hidden.');
  print({ id, status: 'hidden' });
}

async function restore(args: string[]): Promise<void> {
  const id = requireCommentId(args[0]);
  const changed = await setCommentStatus(neonDb('Comment'), id, 'published');
  if (!changed) throw new Error('Comment was not found. Nothing was restored.');
  print({ id, status: 'published' });
}

// Permanently removes the comment; if it has replies, they are removed with it
// because a missing parent would leave them unreachable.
async function remove(args: string[]): Promise<void> {
  const id = requireCommentId(args[0]);
  if (!args.includes('--confirm-delete')) {
    throw new Error(
      'Usage: npm run comments:delete -- <comment-id> --confirm-delete',
    );
  }

  const result = await deleteCommentWithReplies(neonDb('Comment'), id);
  if (!result) throw new Error('Comment was not found. Nothing was deleted.');

  // The removed rows are echoed because this step is irreversible: an operator
  // who mistyped an id can at least see what was destroyed and re-post it.
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
}

// Posts a public reply as the site author. The author badge comes from the
// database row, never from the display name.
async function reply(args: string[]): Promise<void> {
  const parentId = requireCommentId(option(args, '--parent') ?? args[0]);
  if (!args.includes('--confirm-reply')) {
    throw new Error(
      'Usage: npm run comments:reply -- --parent <comment-id> --body "<text>" --confirm-reply',
    );
  }

  const validated = validateCommentInput({
    name: option(args, '--name') ?? COMMENT_AUTHOR_NAME,
    body: option(args, '--body'),
  });
  if (!validated.ok)
    throw new Error(`Reply was not posted: ${validated.error}.`);

  const created = await createAuthorReply(neonDb('Comment'), {
    parentId,
    name: validated.value.name,
    body: validated.value.body,
  });
  if (!created) {
    throw new Error(
      'Parent comment was not found, is not a top-level comment, or is hidden. Nothing was posted.',
    );
  }

  print({
    id: created.id,
    postSlug: created.post_slug,
    parentId: created.parent_id,
    isAuthor: true,
  });
}

const [command, ...args] = process.argv.slice(2);

switch (command) {
  case 'list':
    await list(args);
    break;
  case 'hide':
    await hide(args);
    break;
  case 'restore':
    await restore(args);
    break;
  case 'delete':
    await remove(args);
    break;
  case 'reply':
    await reply(args);
    break;
  default:
    throw new Error(`Unknown command "${command ?? ''}".\n${USAGE}`);
}
