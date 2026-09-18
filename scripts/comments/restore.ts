import { commentsDb } from '../../src/lib/comments/db.ts';
import { setCommentStatus } from '../../src/lib/comments/store.ts';
import { print, requireCommentId } from './cli.ts';

// Usage: npm run comments:restore -- <comment-id>
const id = requireCommentId(process.argv[2]);

const changed = await setCommentStatus(commentsDb(), id, 'published');
if (!changed) throw new Error('Comment was not found. Nothing was restored.');

print({ id, status: 'published' });
