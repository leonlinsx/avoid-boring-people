import type { CommentDb } from './db.ts';
import {
  RATE_LIMIT_MAX_COMMENTS,
  commentErrorMessages,
  normalizeCommentId,
  normalizeCommentSlug,
  toPublicComment,
  validateCommentBody,
  validateCommentInput,
  type CommentErrorCode,
} from './domain.ts';
import {
  countRecentComments,
  createComment,
  deleteOwnComment,
  listPublishedComments,
  updateOwnCommentBody,
} from './store.ts';
import {
  commentTokenCookie,
  createCommentToken,
  hashCommentToken,
  readCommentToken,
} from './tokens.ts';
import { verifyTurnstile } from './turnstile.ts';
import { isSameSiteRequest } from '../site-origin.ts';

// A comment body is at most a few thousand characters, so a request larger than
// this is never real content and is rejected before it is parsed.
export const MAX_COMMENT_REQUEST_BYTES = 16 * 1024;

export type CommentHandlerDeps = {
  // null when the comment database is not configured in this environment.
  db: CommentDb | null;
  fetchImpl?: typeof fetch;
  turnstileSecret?: string;
};

function jsonHeaders(
  extra: Record<string, string> = {},
): Record<string, string> {
  return {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    // Responses carry per-browser ownership flags, so no shared cache may
    // reuse one reader's response for another.
    vary: 'Cookie',
    ...extra,
  };
}

function errorResponse(status: number, error: CommentErrorCode): Response {
  return new Response(
    JSON.stringify({
      ok: false,
      error,
      message: commentErrorMessages[error],
    }),
    { status, headers: jsonHeaders() },
  );
}

function okResponse(
  payload: Record<string, unknown>,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify({ ok: true, ...payload }), {
    status,
    headers: jsonHeaders(headers),
  });
}

function logFailure(operation: string, error: unknown): void {
  // Never log comment bodies, display names, or tokens.
  console.error(`comment_${operation}_failed`, {
    name: error instanceof Error ? error.name : 'unknown',
    message: error instanceof Error ? error.message : 'unknown',
  });
}

type RefusalReason =
  | 'db_unconfigured'
  | 'turnstile_unconfigured'
  | 'turnstile_unavailable'
  | 'turnstile_invalid';

// Refusals are expected outcomes, not exceptions, but a sitewide 503 with no
// log is indistinguishable from one reader's mistake. The reason carries no
// request data.
function logRefusal(operation: string, reason: RefusalReason): void {
  console.error('comment_refused', { operation, reason });
}

function unavailable(operation: string, reason: RefusalReason): Response {
  logRefusal(operation, reason);
  return errorResponse(503, 'unavailable');
}

type ParsedBody =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; error: CommentErrorCode };

async function readJsonBody(request: Request): Promise<ParsedBody> {
  const declaredLength = Number(request.headers.get('content-length') ?? '');
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_COMMENT_REQUEST_BYTES
  )
    return { ok: false, error: 'too_large' };

  let text: string;
  try {
    text = await request.text();
  } catch {
    return { ok: false, error: 'invalid_request' };
  }
  if (!text || text.length > MAX_COMMENT_REQUEST_BYTES)
    return { ok: false, error: text ? 'too_large' : 'invalid_request' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'invalid_request' };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    return { ok: false, error: 'invalid_request' };
  return { ok: true, value: parsed as Record<string, unknown> };
}

function isHoneypotFilled(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  return String(value).trim() !== '';
}

export async function handleListComments(
  request: Request,
  params: { slug: string },
  deps: CommentHandlerDeps,
): Promise<Response> {
  const slug = normalizeCommentSlug(params.slug);
  if (!slug) return errorResponse(404, 'invalid_slug');
  if (!deps.db) return unavailable('list', 'db_unconfigured');

  const token = readCommentToken(request.headers.get('cookie'));
  try {
    const rows = await listPublishedComments(
      deps.db,
      slug,
      token ? hashCommentToken(token) : null,
    );
    return okResponse({ comments: rows.map(toPublicComment) });
  } catch (error) {
    logFailure('list', error);
    return errorResponse(503, 'unavailable');
  }
}

export async function handleCreateComment(
  request: Request,
  params: { slug: string },
  deps: CommentHandlerDeps,
): Promise<Response> {
  if (!isSameSiteRequest(request)) return errorResponse(403, 'cross_site');

  const slug = normalizeCommentSlug(params.slug);
  if (!slug) return errorResponse(404, 'invalid_slug');
  if (!deps.db) return unavailable('create', 'db_unconfigured');

  const parsed = await readJsonBody(request);
  if (!parsed.ok)
    return errorResponse(
      parsed.error === 'too_large' ? 413 : 400,
      parsed.error,
    );

  // Verification happens before anything is written, and a Turnstile outage
  // fails closed: no unverified comment is ever accepted.
  const verification = await verifyTurnstile(parsed.value.turnstileToken, {
    secret: deps.turnstileSecret,
    fetchImpl: deps.fetchImpl,
  });
  if (verification === 'unconfigured')
    return unavailable('create', 'turnstile_unconfigured');
  if (verification === 'unavailable')
    return unavailable('create', 'turnstile_unavailable');
  if (verification === 'invalid') {
    logRefusal('create', 'turnstile_invalid');
    return errorResponse(400, 'verification_failed');
  }

  // Honeypot: a filled field is a bot, which gets the same response as a
  // successful post and no indication that anything was rejected.
  if (isHoneypotFilled(parsed.value.website)) return okResponse({});

  const validated = validateCommentInput({
    name: parsed.value.name,
    body: parsed.value.body,
  });
  if (!validated.ok) return errorResponse(400, validated.error);

  let parentId: string | null = null;
  if (parsed.value.parentId !== undefined && parsed.value.parentId !== null) {
    parentId = normalizeCommentId(parsed.value.parentId);
    if (!parentId) return errorResponse(400, 'invalid_parent');
  }

  const existingToken = readCommentToken(request.headers.get('cookie'));
  const token = existingToken ?? createCommentToken();
  const tokenHash = hashCommentToken(token);

  try {
    const recent = await countRecentComments(deps.db, tokenHash);
    if (recent >= RATE_LIMIT_MAX_COMMENTS)
      return errorResponse(429, 'rate_limited');

    const row = await createComment(deps.db, {
      slug,
      parentId,
      tokenHash,
      name: validated.value.name,
      body: validated.value.body,
    });
    if (!row) return errorResponse(400, 'invalid_parent');

    return okResponse(
      { comment: { ...toPublicComment(row), canEdit: true } },
      201,
      existingToken ? {} : { 'set-cookie': commentTokenCookie(token) },
    );
  } catch (error) {
    logFailure('create', error);
    return errorResponse(503, 'unavailable');
  }
}

export async function handleUpdateComment(
  request: Request,
  params: { slug: string; id: string },
  deps: CommentHandlerDeps,
): Promise<Response> {
  if (!isSameSiteRequest(request)) return errorResponse(403, 'cross_site');

  const slug = normalizeCommentSlug(params.slug);
  if (!slug) return errorResponse(404, 'invalid_slug');
  const id = normalizeCommentId(params.id);
  if (!id) return errorResponse(404, 'not_found');
  if (!deps.db) return unavailable('update', 'db_unconfigured');

  // An absent or unrecognized ownership cookie can never match a stored hash, so
  // it fails the same way as an expired edit window.
  const token = readCommentToken(request.headers.get('cookie'));
  if (!token) return errorResponse(403, 'not_owned');

  const parsed = await readJsonBody(request);
  if (!parsed.ok)
    return errorResponse(
      parsed.error === 'too_large' ? 413 : 400,
      parsed.error,
    );

  const validated = validateCommentBody(parsed.value.body);
  if (!validated.ok) return errorResponse(400, validated.error);

  try {
    const row = await updateOwnCommentBody(deps.db, {
      id,
      slug,
      tokenHash: hashCommentToken(token),
      body: validated.value,
    });
    if (!row) return errorResponse(403, 'not_owned');
    return okResponse({ comment: { ...toPublicComment(row), canEdit: true } });
  } catch (error) {
    logFailure('update', error);
    return errorResponse(503, 'unavailable');
  }
}

export async function handleDeleteComment(
  request: Request,
  params: { slug: string; id: string },
  deps: CommentHandlerDeps,
): Promise<Response> {
  if (!isSameSiteRequest(request)) return errorResponse(403, 'cross_site');

  const slug = normalizeCommentSlug(params.slug);
  if (!slug) return errorResponse(404, 'invalid_slug');
  const id = normalizeCommentId(params.id);
  if (!id) return errorResponse(404, 'not_found');
  if (!deps.db) return unavailable('delete', 'db_unconfigured');

  const token = readCommentToken(request.headers.get('cookie'));
  if (!token) return errorResponse(403, 'not_owned');

  try {
    const outcome = await deleteOwnComment(deps.db, {
      id,
      slug,
      tokenHash: hashCommentToken(token),
    });
    if (outcome === 'unavailable') return errorResponse(403, 'not_owned');
    return okResponse({ removed: outcome });
  } catch (error) {
    logFailure('delete', error);
    return errorResponse(503, 'unavailable');
  }
}
