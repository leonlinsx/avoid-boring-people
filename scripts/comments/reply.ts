import { commentsDb } from '../../src/lib/comments/db.ts';
import {
  COMMENT_AUTHOR_NAME,
  validateCommentInput,
} from '../../src/lib/comments/domain.ts';
import { createAuthorReply } from '../../src/lib/comments/store.ts';
import { option, print, requireCommentId } from './cli.ts';

// Usage: npm run comments:reply -- --parent <comment-id> --body "..." --confirm-reply
// Posts a public reply as the site author. The author badge comes from the
// database row, never from the display name.
const parentId = requireCommentId(option('--parent') ?? process.argv[2]);
if (!process.argv.includes('--confirm-reply')) {
  throw new Error(
    'Usage: npm run comments:reply -- --parent <comment-id> --body "<text>" --confirm-reply',
  );
}

const validated = validateCommentInput({
  name: option('--name') ?? COMMENT_AUTHOR_NAME,
  body: option('--body'),
});
if (!validated.ok) throw new Error(`Reply was not posted: ${validated.error}.`);

const created = await createAuthorReply(commentsDb(), {
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
