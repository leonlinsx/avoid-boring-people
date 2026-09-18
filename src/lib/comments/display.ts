import type { PublicComment } from './domain.ts';

export type CommentThread = {
  comment: PublicComment;
  replies: PublicComment[];
};

// One level of replies: a reply is only rendered while its parent is part of the
// payload, so a comment that disappeared between requests cannot leave a reply
// floating at the top level.
export function groupCommentThreads(
  comments: PublicComment[],
): CommentThread[] {
  const ordered = [...comments].sort(compareComments);
  const threads = new Map<string, CommentThread>();
  const replies: PublicComment[] = [];
  for (const comment of ordered) {
    if (comment.parentId) replies.push(comment);
    else threads.set(comment.id, { comment, replies: [] });
  }
  for (const reply of replies) {
    threads.get(reply.parentId as string)?.replies.push(reply);
  }
  return [...threads.values()];
}

export function commentCount(comments: PublicComment[]): number {
  return comments.length;
}

export function formatCommentTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function isEdited(comment: PublicComment): boolean {
  if (!comment.createdAt || !comment.updatedAt) return false;
  return (
    new Date(comment.updatedAt).getTime() >
    new Date(comment.createdAt).getTime()
  );
}

function compareComments(a: PublicComment, b: PublicComment): number {
  return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
}
