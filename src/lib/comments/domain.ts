// Validation, limits, and public serialization for the first-party discussion
// system. Deliberately free of Node-only imports so the discussion island can
// share the same limits it enforces server-side.

export const DEFAULT_DISCUSSION_PROMPT = 'What did I miss?';

export const MAX_AUTHOR_NAME_LENGTH = 60;
export const MAX_COMMENT_BODY_LENGTH = 3000;
export const MAX_DISCUSSION_PROMPT_LENGTH = 160;
export const MAX_COMMENT_SLUG_LENGTH = 120;

// Self-service edits and deletions are only possible from the browser that
// created the comment, and only for this long after creation.
export const EDIT_WINDOW_MINUTES = 30;
export const EDIT_WINDOW_INTERVAL = `${EDIT_WINDOW_MINUTES} minutes`;

// Friction control, not an identity boundary: a reader can clear cookies and
// start again. Turnstile is the primary anti-automation control.
export const RATE_LIMIT_MAX_COMMENTS = 3;
export const RATE_LIMIT_WINDOW_MINUTES = 10;
export const RATE_LIMIT_WINDOW_INTERVAL = `${RATE_LIMIT_WINDOW_MINUTES} minutes`;

// Display name used for replies written by the local operator CLI. The badge is
// driven by is_author, never by this string, so a public visitor typing "Leon"
// gets no badge.
export const COMMENT_AUTHOR_NAME = 'Leon';

export const DELETED_COMMENT_PLACEHOLDER = '[comment deleted]';

export const commentErrorMessages = {
  name_required: 'Please add a display name.',
  name_too_long: `Display names are limited to ${MAX_AUTHOR_NAME_LENGTH} characters.`,
  body_required: 'Please write a comment.',
  body_too_long: `Comments are limited to ${MAX_COMMENT_BODY_LENGTH} characters.`,
  verification_required: 'Verification is still completing. Please try again.',
  verification_failed:
    'Verification failed. Please try again, then re-post your comment.',
  unavailable: 'Discussion is temporarily unavailable.',
  invalid_slug: 'That article could not be found.',
  invalid_parent: 'That comment is no longer available to reply to.',
  invalid_request: 'That request could not be read.',
  too_large: 'That comment is too large to post.',
  cross_site: 'Cross-site comment requests are not accepted.',
  rate_limited:
    'You have posted several comments in a short time. Please try again in a few minutes.',
  not_owned: 'That comment can no longer be changed from this browser.',
  not_found: 'That comment no longer exists.',
} as const;

export type CommentErrorCode = keyof typeof commentErrorMessages;

export type CommentInput = {
  name: string;
  body: string;
};

export type CommentValidationResult =
  | { ok: true; value: CommentInput }
  | { ok: false; error: CommentErrorCode };

// One clean line-ending convention, no more than one blank line between
// paragraphs, and no leading or trailing whitespace. Everything else in the body
// is preserved exactly as typed.
export function normalizeCommentText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export type CommentBodyValidationResult =
  | { ok: true; value: string }
  | { ok: false; error: CommentErrorCode };

export function validateCommentBody(
  value: unknown,
): CommentBodyValidationResult {
  const body = normalizeCommentText(value);
  if (!body) return { ok: false, error: 'body_required' };
  if (body.length > MAX_COMMENT_BODY_LENGTH)
    return { ok: false, error: 'body_too_long' };
  return { ok: true, value: body };
}

export function validateCommentInput(input: {
  name: unknown;
  body: unknown;
}): CommentValidationResult {
  const name = normalizeCommentText(input.name);
  if (!name) return { ok: false, error: 'name_required' };
  if (name.length > MAX_AUTHOR_NAME_LENGTH)
    return { ok: false, error: 'name_too_long' };
  const body = validateCommentBody(input.body);
  if (!body.ok) return { ok: false, error: body.error };
  return { ok: true, value: { name, body: body.value } };
}

const SLUG_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Articles are the only valid discussion hosts, but V1 does not keep a registry
// of slugs: syntax and length are checked here and the discussion component is
// only rendered on real article pages.
export function normalizeCommentSlug(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const slug = value.trim();
  if (
    !slug ||
    slug.length > MAX_COMMENT_SLUG_LENGTH ||
    !SLUG_PATTERN.test(slug)
  )
    return null;
  return slug;
}

export function normalizeCommentId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const id = value.trim().toLowerCase();
  return UUID_PATTERN.test(id) ? id : null;
}

export function discussionPrompt(value: unknown): string {
  const prompt = normalizeCommentText(value).replace(/\s+/g, ' ');
  if (!prompt) return DEFAULT_DISCUSSION_PROMPT;
  return prompt.slice(0, MAX_DISCUSSION_PROMPT_LENGTH);
}

export type CommentRow = {
  id: string;
  parent_id: string | null;
  author_name: string | null;
  body: string | null;
  is_author: boolean;
  created_at: string | Date;
  updated_at: string | Date;
  can_edit?: boolean | null;
};

export type PublicComment = {
  id: string;
  parentId: string | null;
  authorName: string;
  body: string;
  isAuthor: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  canEdit: boolean;
};

function toIso(value: string | Date): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

export function toPublicComment(row: CommentRow): PublicComment {
  const isDeleted = row.author_name === null || row.body === null;
  return {
    id: row.id,
    parentId: row.parent_id ?? null,
    authorName: row.author_name ?? '',
    body: isDeleted ? DELETED_COMMENT_PLACEHOLDER : (row.body ?? ''),
    isAuthor: row.is_author === true,
    isDeleted,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    canEdit: row.can_edit === true,
  };
}
