import {
  commentErrorMessages,
  normalizeCommentId,
  normalizeCommentSlug,
  validateCommentBody,
} from '../../src/lib/comments/domain.ts';

export function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

export function requireCommentId(value: string | undefined): string {
  const id = normalizeCommentId(value ?? '');
  if (!id) throw new Error('A comment UUID is required.');
  return id;
}

export function requireCommentSlug(value: string | undefined): string {
  const slug = normalizeCommentSlug(value ?? '');
  if (!slug) throw new Error('A valid article slug is required.');
  return slug;
}

export function requireCommentBody(value: string | undefined): string {
  const body = validateCommentBody(value);
  if (!body.ok) throw new Error(commentErrorMessages[body.error]);
  return body.value;
}

export function print(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}
