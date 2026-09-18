import { commentsDb } from '../../src/lib/comments/db.ts';
import { listCommentsForOperator } from '../../src/lib/comments/store.ts';
import { option, print, requireCommentSlug } from './cli.ts';

// Usage: npm run comments:list -- [--slug <article-slug>] [--include-hidden]
const slugOption = option('--slug');
const slug = slugOption === undefined ? null : requireCommentSlug(slugOption);
const includeHidden = process.argv.includes('--include-hidden');

const rows = await listCommentsForOperator(commentsDb(), {
  slug,
  includeHidden,
});
print({
  slug,
  includeHidden,
  count: rows.length,
  comments: rows,
});
