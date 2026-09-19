// Discussion coverage: body/token handling, Turnstile, handlers, SQL, and route integration.

import assert from 'node:assert/strict';

import {
  DELETED_COMMENT_PLACEHOLDER,
  EDIT_WINDOW_INTERVAL,
  MAX_AUTHOR_NAME_LENGTH,
  MAX_COMMENT_BODY_LENGTH,
  MAX_DISCUSSION_PROMPT_LENGTH,
  RATE_LIMIT_MAX_COMMENTS,
  RATE_LIMIT_WINDOW_INTERVAL,
  discussionPrompt,
  normalizeCommentId,
  normalizeCommentSlug,
  normalizeCommentText,
  toPublicComment,
  validateCommentBody,
  validateCommentInput,
  type CommentRow,
} from '../../src/lib/comments/domain.ts';
import {
  COMMENT_TOKEN_COOKIE,
  commentTokenCookie,
  createCommentToken,
  hashCommentToken,
  isCommentTokenShape,
  readCommentToken,
} from '../../src/lib/comments/tokens.ts';
import {
  handleCreateComment,
  handleDeleteComment,
  handleListComments,
  handleUpdateComment,
  MAX_COMMENT_REQUEST_BYTES,
  type CommentHandlerDeps,
} from '../../src/lib/comments/handlers.ts';
import {
  countRecentComments,
  createAuthorReply,
  createComment,
  deleteCommentWithReplies,
  deleteOwnComment,
  listCommentsForOperator,
  listPublishedComments,
  setCommentStatus,
  updateOwnCommentBody,
} from '../../src/lib/comments/store.ts';
import {
  commentCount,
  formatCommentTimestamp,
  groupCommentThreads,
  isEdited,
} from '../../src/lib/comments/display.ts';
import {
  TURNSTILE_VERIFY_URL,
  turnstileSiteKey,
  verifyTurnstile,
  warnIfSiteKeyMissing,
} from '../../src/lib/turnstile.ts';
import { isSameSiteRequest } from '../../src/lib/site-origin.ts';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  REPO_ROOT,
  makeFakeDb,
  makeForbiddenDb,
  soleQuery,
  verifiedTurnstileFetch,
} from '../helpers/harness.ts';

export const COMMENT_SLUG = 'sample-article';
export const COMMENT_ID_PRIMARY = '11111111-1111-4111-8111-111111111111';
export const COMMENT_ID_REPLY = '22222222-2222-4222-8222-222222222222';

export function makeCommentRow(
  overrides: Partial<CommentRow> = {},
): CommentRow {
  return {
    id: COMMENT_ID_PRIMARY,
    parent_id: null,
    author_name: 'Reader',
    body: 'A thoughtful comment',
    is_author: false,
    created_at: '2026-09-17T10:00:00.000Z',
    updated_at: '2026-09-17T10:00:00.000Z',
    can_edit: false,
    ...overrides,
  };
}

export function testCommentDomain() {
  // One clean line-ending convention, collapsed blank lines, no stray whitespace.
  assert.equal(
    normalizeCommentText('  first  \r\nsecond\r\n\r\n\r\n\r\nthird\t'),
    'first\nsecond\n\nthird',
  );
  assert.equal(normalizeCommentText('keep\n\nthis'), 'keep\n\nthis');
  assert.equal(normalizeCommentText(undefined), '');
  assert.equal(normalizeCommentText(42), '');

  // Bodies are required and length-limited; the limits mirror the schema.
  assert.deepEqual(validateCommentBody('   '), {
    ok: false,
    error: 'body_required',
  });
  assert.deepEqual(
    validateCommentBody('a'.repeat(MAX_COMMENT_BODY_LENGTH + 1)),
    {
      ok: false,
      error: 'body_too_long',
    },
  );
  assert.deepEqual(validateCommentBody('a'.repeat(MAX_COMMENT_BODY_LENGTH)), {
    ok: true,
    value: 'a'.repeat(MAX_COMMENT_BODY_LENGTH),
  });

  assert.deepEqual(validateCommentInput({ name: '  ', body: 'hello' }), {
    ok: false,
    error: 'name_required',
  });
  assert.deepEqual(
    validateCommentInput({
      name: 'a'.repeat(MAX_AUTHOR_NAME_LENGTH + 1),
      body: 'hello',
    }),
    { ok: false, error: 'name_too_long' },
  );
  assert.deepEqual(validateCommentInput({ name: '  Leon  ', body: '  hi  ' }), {
    ok: true,
    value: { name: 'Leon', body: 'hi' },
  });

  // Slugs are accepted only in the shape an article slug can take.
  assert.equal(normalizeCommentSlug(' my.article_2 '), 'my.article_2');
  for (const bad of [
    '',
    '   ',
    '-leading',
    '../etc/passwd',
    'has space',
    'a/b',
    'x'.repeat(121),
    null,
    7,
  ]) {
    assert.equal(
      normalizeCommentSlug(bad),
      null,
      `${String(bad)} must not be a valid discussion slug`,
    );
  }

  const uuid = 'ABCDEF01-2345-6789-abcd-ef0123456789';
  assert.equal(normalizeCommentId(uuid), uuid.toLowerCase());
  for (const bad of [
    '',
    'not-a-uuid',
    '11111111-1111-1111-1111-1111111111',
    `${uuid}0`,
    null,
    1,
  ]) {
    assert.equal(
      normalizeCommentId(bad),
      null,
      `${String(bad)} must not be a valid comment id`,
    );
  }

  // The prompt falls back to the design's default and is bounded.
  assert.equal(discussionPrompt(''), 'What did I miss?');
  assert.equal(discussionPrompt(undefined), 'What did I miss?');
  assert.equal(discussionPrompt(null), 'What did I miss?');
  assert.equal(discussionPrompt('  What   did\nI miss? '), 'What did I miss?');
  assert.equal(
    discussionPrompt('x'.repeat(500)).length,
    MAX_DISCUSSION_PROMPT_LENGTH,
  );

  // The edit window is enforced by the database clock; the application only
  // checks that the caller owns the row.
  assert.equal(EDIT_WINDOW_INTERVAL, '30 minutes');

  const published = toPublicComment(makeCommentRow({ can_edit: true }));
  assert.deepEqual(published, {
    id: COMMENT_ID_PRIMARY,
    parentId: null,
    authorName: 'Reader',
    body: 'A thoughtful comment',
    isAuthor: false,
    isDeleted: false,
    createdAt: '2026-09-17T10:00:00.000Z',
    updatedAt: '2026-09-17T10:00:00.000Z',
    canEdit: true,
  });

  // A content-removed row keeps its place with no name and no original text.
  const removed = toPublicComment(
    makeCommentRow({ author_name: null, body: null }),
  );
  assert.equal(removed.isDeleted, true);
  assert.equal(removed.body, DELETED_COMMENT_PLACEHOLDER);
  assert.equal(removed.authorName, '');

  // Only the database column grants the badge, never the display name.
  const author = toPublicComment(
    makeCommentRow({ author_name: 'Leon', is_author: true }),
  );
  assert.equal(author.isAuthor, true);
  assert.equal(
    toPublicComment(makeCommentRow({ author_name: 'Leon' })).isAuthor,
    false,
  );
}

export function testCommentTokens() {
  const token = createCommentToken();
  assert.equal(token.length, 43, '256 bits of base64url is 43 characters');
  assert.equal(isCommentTokenShape(token), true);
  assert.notEqual(createCommentToken(), createCommentToken());
  assert.equal(
    hashCommentToken(token),
    createHash('sha256').update(token).digest('hex'),
  );
  assert.notEqual(hashCommentToken(token), token);
  assert.equal(hashCommentToken(token).length, 64);

  for (const bad of ['', 'short', `${token}=`, 'a'.repeat(44), null, 1]) {
    assert.equal(isCommentTokenShape(bad), false);
  }

  // The ownership cookie must not be reachable from script, must not be sent
  // cross-site, and must not be scoped to a single article.
  const cookie = commentTokenCookie(token).split('; ');
  assert.equal(cookie[0], `${COMMENT_TOKEN_COOKIE}=${token}`);
  for (const attribute of ['Path=/', 'HttpOnly', 'Secure', 'SameSite=Strict']) {
    assert.ok(cookie.includes(attribute), `cookie must set ${attribute}`);
  }
  assert.ok(cookie.some((part) => part.startsWith('Max-Age=')));
  assert.ok(!cookie.includes('Domain=/'));

  assert.equal(
    readCommentToken(`theme=dark; ${COMMENT_TOKEN_COOKIE}=${token}; other=1`),
    token,
  );
  assert.equal(readCommentToken(null), null);
  assert.equal(readCommentToken(''), null);
  assert.equal(readCommentToken(`theme=dark`), null);
  assert.equal(readCommentToken(`${COMMENT_TOKEN_COOKIE}=not-a-token`), null);
}

export function testCommentDisplay() {
  const parent = toPublicComment(
    makeCommentRow({
      id: COMMENT_ID_PRIMARY,
      created_at: '2026-09-17T10:00:00Z',
    }),
  );
  const reply = toPublicComment(
    makeCommentRow({
      id: COMMENT_ID_REPLY,
      parent_id: COMMENT_ID_PRIMARY,
      created_at: '2026-09-17T10:05:00Z',
    }),
  );
  const orphan = toPublicComment(
    makeCommentRow({
      id: '33333333-3333-4333-8333-333333333333',
      parent_id: '44444444-4444-4444-8444-444444444444',
      created_at: '2026-09-17T10:06:00Z',
    }),
  );

  const threads = groupCommentThreads([reply, orphan, parent]);
  assert.equal(threads.length, 1, 'a reply without its parent is not shown');
  assert.equal(threads[0].comment.id, COMMENT_ID_PRIMARY);
  assert.deepEqual(
    threads[0].replies.map((comment) => comment.id),
    [COMMENT_ID_REPLY],
  );
  assert.equal(commentCount([parent, reply, orphan]), 3);

  assert.equal(
    isEdited(
      toPublicComment(
        makeCommentRow({ updated_at: '2026-09-17T10:02:00.000Z' }),
      ),
    ),
    true,
  );
  assert.equal(isEdited(parent), false);
  assert.equal(formatCommentTimestamp('not a timestamp'), '');
  assert.ok(formatCommentTimestamp('2026-09-17T10:00:00.000Z').length > 0);
}

export async function testCommentTurnstile() {
  // The site key normalizer gates the form; a blank value disables it entirely.
  assert.equal(
    turnstileSiteKey('  1x00000000000000000000AA  '),
    '1x00000000000000000000AA',
  );
  assert.equal(turnstileSiteKey(''), null);
  assert.equal(turnstileSiteKey('   '), null);
  assert.equal(turnstileSiteKey(undefined), null);

  // A missing site key silently disables every Turnstile-protected form, so the
  // build log has to say so once per surface rather than once per page. The
  // message is the key: each surface words its own explanation.
  const warnings: unknown[][] = [];
  const originalConsoleWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    warnings.push(args);
  };
  try {
    warnIfSiteKeyMissing(null, '[discussion] missing site key');
    warnIfSiteKeyMissing(null, '[discussion] missing site key');
    warnIfSiteKeyMissing(null, '[contact] missing site key');
    warnIfSiteKeyMissing('1x00000000000000000000AA', '[discussion] ignored');
  } finally {
    console.warn = originalConsoleWarn;
  }
  assert.equal(
    warnings.length,
    2,
    'one warning per surface, not one per page render',
  );
  assert.deepEqual(
    warnings,
    [['[discussion] missing site key'], ['[contact] missing site key']],
    'each surface words its own explanation, and an unset key is not a warning',
  );

  const originalSecret = process.env.TURNSTILE_SECRET_KEY;
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const respond = (body: string, status = 200) =>
    (async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(body, { status });
    }) as unknown as typeof fetch;

  try {
    delete process.env.TURNSTILE_SECRET_KEY;

    // Unconfigured verification fails closed instead of accepting the comment.
    assert.equal(await verifyTurnstile('token', {}), 'unconfigured');
    assert.equal(
      await verifyTurnstile('token', { secret: '' }),
      'unconfigured',
    );
    assert.equal(calls.length, 0, 'nothing is sent without a secret');

    // A missing widget token never reaches Cloudflare.
    assert.equal(
      await verifyTurnstile('  ', { secret: 'secret', fetchImpl: respond('') }),
      'invalid',
    );
    assert.equal(await verifyTurnstile(42, { secret: 'secret' }), 'invalid');
    assert.equal(calls.length, 0);

    assert.equal(
      await verifyTurnstile('token', {
        secret: 'secret',
        fetchImpl: respond(JSON.stringify({ success: true })),
      }),
      'verified',
    );
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, TURNSTILE_VERIFY_URL);
    assert.equal(calls[0].init?.method, 'POST');
    const body = String(calls[0].init?.body);
    assert.ok(body.includes('secret=secret'));
    assert.ok(body.includes('response=token'));
    assert.ok(
      !body.includes('remoteip'),
      'the discussion stores no IP addresses, so none is sent',
    );

    assert.equal(
      await verifyTurnstile('token', {
        secret: 'secret',
        fetchImpl: respond(JSON.stringify({ success: false })),
      }),
      'invalid',
    );

    // Cloudflare errors, unreadable bodies, and timeouts all fail closed.
    assert.equal(
      await verifyTurnstile('token', {
        secret: 'secret',
        fetchImpl: respond('upstream down', 500),
      }),
      'unavailable',
    );
    assert.equal(
      await verifyTurnstile('token', {
        secret: 'secret',
        fetchImpl: respond('not json'),
      }),
      'unavailable',
    );
    // A Cloudflare request that never answers is abandoned and fails closed.
    // The keep-alive timer is required because Node's `AbortSignal.timeout`
    // timer is unref'd: without another handle the process would exit instead of
    // firing the abort.
    const aborting = (async (_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new Error('turnstile request timed out')),
        );
      })) as unknown as typeof fetch;
    const keepAlive = setTimeout(() => {}, 200);
    try {
      assert.equal(
        await verifyTurnstile('token', {
          secret: 'secret',
          fetchImpl: aborting,
          timeoutMs: 10,
        }),
        'unavailable',
      );
    } finally {
      clearTimeout(keepAlive);
    }

    // The secret is read from the environment when the caller does not inject it.
    process.env.TURNSTILE_SECRET_KEY = 'env-secret';
    assert.equal(
      await verifyTurnstile('token', {
        fetchImpl: respond(JSON.stringify({ success: true })),
      }),
      'verified',
    );
  } finally {
    if (originalSecret === undefined) delete process.env.TURNSTILE_SECRET_KEY;
    else process.env.TURNSTILE_SECRET_KEY = originalSecret;
  }
}

export async function testCommentHandlers() {
  const jsonOf = async (response: Response) =>
    (await response.json()) as Record<string, unknown>;
  const listUrl = `https://leonlins.com/api/comments/${COMMENT_SLUG}`;
  const handlerDeps = (
    overrides: Partial<CommentHandlerDeps> = {},
  ): CommentHandlerDeps => ({
    db: null,
    turnstileSecret: 'secret',
    fetchImpl: verifiedTurnstileFetch,
    ...overrides,
  });
  const post = (
    payload: Record<string, unknown>,
    deps: CommentHandlerDeps,
    headers: Record<string, string> = {},
  ) =>
    handleCreateComment(
      new Request(listUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'https://leonlins.com',
          ...headers,
        },
        body: JSON.stringify(payload),
      }),
      { slug: COMMENT_SLUG },
      deps,
    );
  const patch = (
    payload: Record<string, unknown>,
    deps: CommentHandlerDeps,
    options: { id?: string; headers?: Record<string, string> } = {},
  ) =>
    handleUpdateComment(
      new Request(`${listUrl}/${options.id ?? COMMENT_ID_PRIMARY}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          origin: 'https://leonlins.com',
          ...options.headers,
        },
        body: JSON.stringify(payload),
      }),
      { slug: COMMENT_SLUG, id: options.id ?? COMMENT_ID_PRIMARY },
      deps,
    );
  const remove = (
    deps: CommentHandlerDeps,
    options: { id?: string; headers?: Record<string, string> } = {},
  ) =>
    handleDeleteComment(
      new Request(`${listUrl}/${options.id ?? COMMENT_ID_PRIMARY}`, {
        method: 'DELETE',
        headers: { origin: 'https://leonlins.com', ...options.headers },
      }),
      { slug: COMMENT_SLUG, id: options.id ?? COMMENT_ID_PRIMARY },
      deps,
    );

  // --- reading ---------------------------------------------------------------
  const token = createCommentToken();
  const tokenHash = hashCommentToken(token);
  let listValue: unknown = 'unset';
  const list = makeFakeDb((query) => {
    listValue = query.values[0];
    return [makeCommentRow({ can_edit: true })];
  });
  const listed = await handleListComments(
    new Request(listUrl, { headers: { cookie: commentTokenCookie(token) } }),
    { slug: COMMENT_SLUG },
    handlerDeps({ db: list.db }),
  );
  assert.equal(listed.status, 200);
  assert.equal(listed.headers.get('cache-control'), 'no-store');
  assert.equal(listed.headers.get('vary'), 'Cookie');
  assert.match(String(listed.headers.get('content-type')), /application\/json/);
  assert.equal(
    listValue,
    tokenHash,
    'ownership must be compared against the hash, never the token',
  );
  const listBody = await jsonOf(listed);
  const [publicComment] = listBody.comments as Array<Record<string, unknown>>;
  assert.equal(publicComment.canEdit, true);
  assert.equal(publicComment.isAuthor, false);
  const serialized = JSON.stringify(listBody);
  assert.ok(
    !serialized.includes(token),
    'the raw token must never be returned',
  );
  assert.ok(!serialized.includes(tokenHash), 'the token hash must never leak');
  assert.ok(!serialized.includes('author_token_hash'));
  assert.ok(!serialized.includes('status'));

  // Without a cookie the ownership comparison cannot match a stored hash.
  let anonymousValue: unknown = 'unset';
  const anonymous = makeFakeDb((query) => {
    anonymousValue = query.values[0];
    return [];
  });
  const anonymousResponse = await handleListComments(
    new Request(listUrl),
    { slug: COMMENT_SLUG },
    handlerDeps({ db: anonymous.db }),
  );
  assert.equal(anonymousResponse.status, 200);
  assert.equal(anonymousValue, '');
  assert.deepEqual(await jsonOf(anonymousResponse), {
    ok: true,
    comments: [],
  });

  const badSlug = makeForbiddenDb();
  const badSlugResponse = await handleListComments(
    new Request('https://leonlins.com/api/comments/has%20space'),
    { slug: 'has space' },
    handlerDeps({ db: badSlug.db }),
  );
  assert.equal(badSlugResponse.status, 404);
  assert.equal((await jsonOf(badSlugResponse)).error, 'invalid_slug');

  const noDb = await handleListComments(
    new Request(listUrl),
    { slug: COMMENT_SLUG },
    handlerDeps(),
  );
  assert.equal(noDb.status, 503);
  assert.equal((await jsonOf(noDb)).error, 'unavailable');

  // A database failure is reported, and the log carries no comment content.
  const logged: unknown[][] = [];
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    logged.push(args);
  };
  try {
    const failing = makeFakeDb(() => {
      throw new Error('connection reset');
    });
    const failed = await handleListComments(
      new Request(listUrl),
      { slug: COMMENT_SLUG },
      handlerDeps({ db: failing.db }),
    );
    assert.equal(failed.status, 503);
  } finally {
    console.error = originalConsoleError;
  }
  assert.deepEqual(logged, [
    ['comment_list_failed', { name: 'Error', message: 'connection reset' }],
  ]);

  // --- creating --------------------------------------------------------------
  // The second same-origin gate for state-changing requests: a browser that
  // omits `Origin` is allowed (the ownership cookie is SameSite=Strict, so a
  // cross-site request could not carry it), while another site is refused.
  const sameOriginPost = (headers: Record<string, string>) =>
    isSameSiteRequest(new Request(listUrl, { method: 'POST', headers }));
  assert.equal(sameOriginPost({}), true);
  assert.equal(sameOriginPost({ origin: 'https://leonlins.com' }), true);
  assert.equal(sameOriginPost({ origin: 'https://evil.example' }), false);

  // Every create request carries the widget token, because verification happens
  // before anything else can be reported about the payload.
  const commentPayload = {
    name: 'Reader',
    body: 'A thoughtful comment',
    turnstileToken: 'widget-token',
  };
  const unreachableTurnstile = (async () => {
    throw new Error('Turnstile must not be called for this request');
  }) as unknown as typeof fetch;

  const crossSite = makeForbiddenDb();
  const crossSiteResponse = await post(
    commentPayload,
    handlerDeps({ db: crossSite.db, fetchImpl: unreachableTurnstile }),
    { origin: 'https://evil.example' },
  );
  assert.equal(crossSiteResponse.status, 403);
  assert.equal((await jsonOf(crossSiteResponse)).error, 'cross_site');

  const noDbCreate = await post(commentPayload, handlerDeps());
  assert.equal(noDbCreate.status, 503);
  assert.equal((await jsonOf(noDbCreate)).error, 'unavailable');

  const oversized = makeForbiddenDb();
  const oversizedResponse = await handleCreateComment(
    new Request(listUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body: 'x'.repeat(MAX_COMMENT_REQUEST_BYTES + 1) }),
    }),
    { slug: COMMENT_SLUG },
    handlerDeps({ db: oversized.db, fetchImpl: unreachableTurnstile }),
  );
  assert.equal(oversizedResponse.status, 413);
  assert.equal((await jsonOf(oversizedResponse)).error, 'too_large');

  for (const body of ['', 'not json', '[]', '"a string"']) {
    const malformed = makeForbiddenDb();
    const response = await handleCreateComment(
      new Request(listUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
      }),
      { slug: COMMENT_SLUG },
      handlerDeps({ db: malformed.db, fetchImpl: unreachableTurnstile }),
    );
    assert.equal(response.status, 400, `${body || '(empty)'} must be rejected`);
    assert.equal((await jsonOf(response)).error, 'invalid_request');
  }

  // Verification happens before anything is written, and an outage fails closed.
  const unverified = makeForbiddenDb();
  const unconfiguredResponse = await post(
    commentPayload,
    handlerDeps({
      db: unverified.db,
      turnstileSecret: '',
      fetchImpl: unreachableTurnstile,
    }),
  );
  assert.equal(unconfiguredResponse.status, 503);

  const rejected = makeForbiddenDb();
  const rejectedResponse = await post(
    commentPayload,
    handlerDeps({
      db: rejected.db,
      fetchImpl: (async () =>
        new Response(JSON.stringify({ success: false }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })) as unknown as typeof fetch,
    }),
  );
  assert.equal(rejectedResponse.status, 400);
  assert.equal((await jsonOf(rejectedResponse)).error, 'verification_failed');

  const outage = makeForbiddenDb();
  const outageResponse = await post(
    commentPayload,
    handlerDeps({ db: outage.db, fetchImpl: unreachableTurnstile }),
  );
  assert.equal(outageResponse.status, 503);

  // A refusal is expected behavior, but it is logged with the reason so a
  // sitewide 503 can be told apart from one reader's mistake.
  const refusals: unknown[][] = [];
  const refusalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    refusals.push(args);
  };
  try {
    await handleListComments(
      new Request(listUrl),
      { slug: COMMENT_SLUG },
      handlerDeps(),
    );
    await post(commentPayload, handlerDeps());
    await post(
      commentPayload,
      handlerDeps({
        db: makeForbiddenDb().db,
        turnstileSecret: '',
        fetchImpl: unreachableTurnstile,
      }),
    );
    await post(
      commentPayload,
      handlerDeps({
        db: makeForbiddenDb().db,
        fetchImpl: unreachableTurnstile,
      }),
    );
    await post(
      commentPayload,
      handlerDeps({
        db: makeForbiddenDb().db,
        fetchImpl: (async () =>
          new Response(JSON.stringify({ success: false }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })) as unknown as typeof fetch,
      }),
    );
    await patch({ body: 'An edited comment' }, handlerDeps());
    await remove(handlerDeps());
  } finally {
    console.error = refusalConsoleError;
  }
  assert.deepEqual(refusals, [
    ['comment_refused', { operation: 'list', reason: 'db_unconfigured' }],
    ['comment_refused', { operation: 'create', reason: 'db_unconfigured' }],
    [
      'comment_refused',
      { operation: 'create', reason: 'turnstile_unconfigured' },
    ],
    [
      'comment_refused',
      { operation: 'create', reason: 'turnstile_unavailable' },
    ],
    ['comment_refused', { operation: 'create', reason: 'turnstile_invalid' }],
    ['comment_refused', { operation: 'update', reason: 'db_unconfigured' }],
    ['comment_refused', { operation: 'delete', reason: 'db_unconfigured' }],
  ]);

  // The honeypot answers exactly like a success, and stores nothing.
  const honeypotDb = makeFakeDb((query) => {
    throw new Error(`honeypot must not store anything: ${query.text}`);
  });
  const honeypotResponse = await post(
    { ...commentPayload, website: 'https://spam.example' },
    handlerDeps({ db: honeypotDb.db }),
  );
  assert.equal(honeypotResponse.status, 200);
  assert.deepEqual(await jsonOf(honeypotResponse), { ok: true });
  assert.equal(honeypotResponse.headers.get('set-cookie'), null);
  assert.equal(honeypotDb.queries.length, 0);

  for (const [payload, error] of [
    [{ ...commentPayload, name: '   ' }, 'name_required'],
    [
      { ...commentPayload, name: 'a'.repeat(MAX_AUTHOR_NAME_LENGTH + 1) },
      'name_too_long',
    ],
    [{ ...commentPayload, body: '   ' }, 'body_required'],
    [
      {
        ...commentPayload,
        body: 'a'.repeat(MAX_COMMENT_BODY_LENGTH + 1),
      },
      'body_too_long',
    ],
    [{ ...commentPayload, parentId: 'not-a-uuid' }, 'invalid_parent'],
  ] as Array<[Record<string, unknown>, string]>) {
    const invalid = makeForbiddenDb();
    const response = await post(payload, handlerDeps({ db: invalid.db }));
    assert.equal(response.status, 400, `${error} must be a 400`);
    assert.equal((await jsonOf(response)).error, error);
  }

  // Rate limiting is counted from the comments table, before the insert.
  const rateLimitedDb = makeFakeDb((query) => {
    if (!/count\(\*\)/.test(query.text)) {
      throw new Error(`rate limiting must not insert: ${query.text}`);
    }
    return [{ recent: RATE_LIMIT_MAX_COMMENTS }];
  });
  const rateLimited = await post(
    commentPayload,
    handlerDeps({ db: rateLimitedDb.db }),
  );
  assert.equal(rateLimited.status, 429);
  assert.equal((await jsonOf(rateLimited)).error, 'rate_limited');
  assert.equal(rateLimitedDb.queries.length, 1);
  assert.match(rateLimitedDb.queries[0].text, /author_token_hash =/);
  assert.ok(
    rateLimitedDb.queries[0].values.includes(RATE_LIMIT_WINDOW_INTERVAL),
    'the rate-limit window is enforced by the database clock, so posting is allowed again once the oldest comments age out',
  );

  // Below the threshold posting is allowed: the first comments in a window are
  // never the ones that get rejected.
  const underLimitDb = makeFakeDb((query) =>
    /count\(\*\)/.test(query.text)
      ? [{ recent: RATE_LIMIT_MAX_COMMENTS - 1 }]
      : [makeCommentRow()],
  );
  const underLimit = await post(
    commentPayload,
    handlerDeps({ db: underLimitDb.db }),
  );
  assert.equal(underLimit.status, 201);

  // A rejected reply stores nothing and reports the parent as unavailable.
  const replyParent = makeCommentRow({
    id: COMMENT_ID_PRIMARY,
  });
  const missingParentDb = makeFakeDb((query) =>
    /count\(\*\)/.test(query.text) ? [{ recent: 0 }] : [],
  );
  const missingParent = await post(
    { ...commentPayload, parentId: replyParent.id },
    handlerDeps({ db: missingParentDb.db }),
  );
  assert.equal(missingParent.status, 400);
  assert.equal((await jsonOf(missingParent)).error, 'invalid_parent');
  assert.equal(missingParentDb.queries.length, 2);
  assert.match(missingParentDb.queries[1].text, /parent\.parent_id IS NULL/);
  assert.match(missingParentDb.queries[1].text, /INSERT INTO comments/);

  const successDb = makeFakeDb((query) =>
    /count\(\*\)/.test(query.text) ? [{ recent: 0 }] : [makeCommentRow()],
  );
  const created = await post(commentPayload, handlerDeps({ db: successDb.db }));
  assert.equal(created.status, 201);
  const createdBody = await jsonOf(created);
  const createdComment = createdBody.comment as Record<string, unknown>;
  assert.equal(createdComment.isAuthor, false);
  assert.equal(createdComment.canEdit, true);
  assert.equal(createdComment.body, 'A thoughtful comment');

  const inserted = soleQuery(successDb.queries, /INSERT INTO comments/);
  const insertSql = inserted.text;
  assert.match(insertSql, /'published', FALSE/);
  assert.ok(inserted.values.includes(COMMENT_SLUG));
  assert.ok(inserted.values.includes('Reader'));
  assert.ok(inserted.values.includes('A thoughtful comment'));
  assert.ok(
    !inserted.values.includes(true),
    'the public API can never write is_author',
  );

  const setCookie = created.headers.get('set-cookie');
  assert.ok(setCookie, 'a first comment receives an ownership cookie');
  const issued = readCommentToken(setCookie);
  assert.ok(issued && isCommentTokenShape(issued));
  assert.equal(hashCommentToken(issued), tokenHashOfInsert(inserted.values));
  assert.ok(!JSON.stringify(createdBody).includes(issued));

  // An existing browser identity is reused rather than reissued.
  const existingDb = makeFakeDb((query) =>
    /count\(\*\)/.test(query.text) ? [{ recent: 0 }] : [makeCommentRow()],
  );
  const existing = await post(
    commentPayload,
    handlerDeps({ db: existingDb.db }),
    {
      cookie: commentTokenCookie(token),
    },
  );
  assert.equal(existing.status, 201);
  assert.equal(existing.headers.get('set-cookie'), null);
  assert.equal(
    tokenHashOfInsert(
      soleQuery(existingDb.queries, /INSERT INTO comments/).values,
    ),
    tokenHash,
  );

  // A malformed cookie is treated as no identity at all.
  const malformedDb = makeFakeDb((query) =>
    /count\(\*\)/.test(query.text) ? [{ recent: 0 }] : [makeCommentRow()],
  );
  const malformedCookie = await post(
    commentPayload,
    handlerDeps({ db: malformedDb.db }),
    { cookie: `${COMMENT_TOKEN_COOKIE}=not-a-token` },
  );
  assert.equal(malformedCookie.status, 201);
  assert.ok(malformedCookie.headers.get('set-cookie'));
  assert.notEqual(
    tokenHashOfInsert(
      soleQuery(malformedDb.queries, /INSERT INTO comments/).values,
    ),
    hashCommentToken('not-a-token'),
  );

  // A public visitor naming themselves "Leon" gets no author badge.
  const impostorDb = makeFakeDb((query) => {
    if (/count\(\*\)/.test(query.text)) return [{ recent: 0 }];
    return [makeCommentRow({ author_name: 'Leon', is_author: false })];
  });
  const impostor = await post(
    { ...commentPayload, name: 'Leon', body: 'Not the author' },
    handlerDeps({ db: impostorDb.db }),
  );
  assert.equal(impostor.status, 201);
  const impostorBody = await jsonOf(impostor);
  assert.equal(
    (impostorBody.comment as Record<string, unknown>).isAuthor,
    false,
    'only the is_author column grants the badge',
  );

  // --- editing ---------------------------------------------------------------
  const crossSitePatch = makeForbiddenDb();
  const crossSitePatchResponse = await patch(
    { body: 'edited' },
    handlerDeps({ db: crossSitePatch.db }),
    { headers: { origin: 'https://evil.example' } },
  );
  assert.equal(crossSitePatchResponse.status, 403);
  assert.equal((await jsonOf(crossSitePatchResponse)).error, 'cross_site');

  const unknownId = makeForbiddenDb();
  const unknownIdResponse = await patch(
    { body: 'edited' },
    handlerDeps({ db: unknownId.db }),
    { id: 'not-a-uuid' },
  );
  assert.equal(unknownIdResponse.status, 404);
  assert.equal((await jsonOf(unknownIdResponse)).error, 'not_found');

  const noCookie = makeForbiddenDb();
  const noCookieResponse = await patch(
    { body: 'edited' },
    handlerDeps({ db: noCookie.db }),
  );
  assert.equal(noCookieResponse.status, 403);
  assert.equal((await jsonOf(noCookieResponse)).error, 'not_owned');

  const emptyEdit = makeForbiddenDb();
  const emptyEditResponse = await patch(
    { body: '   ' },
    handlerDeps({ db: emptyEdit.db }),
    { headers: { cookie: commentTokenCookie(token) } },
  );
  assert.equal(emptyEditResponse.status, 400);
  assert.equal((await jsonOf(emptyEditResponse)).error, 'body_required');

  // Outside the window (or from another browser) the update simply matches nothing.
  const expiredDb = makeFakeDb(() => []);
  const expired = await patch(
    { body: 'edited' },
    handlerDeps({ db: expiredDb.db }),
    { headers: { cookie: commentTokenCookie(token) } },
  );
  assert.equal(expired.status, 403);
  assert.equal((await jsonOf(expired)).error, 'not_owned');
  assert.match(expiredDb.queries[0].text, /is_author = FALSE/);
  assert.ok(
    expiredDb.queries[0].values.includes(EDIT_WINDOW_INTERVAL),
    'the edit window is enforced by the database clock',
  );

  let updated: { text: string; values: unknown[] } | null = null;
  const updateDb = makeFakeDb((query) => {
    updated = query;
    return [makeCommentRow({ body: 'edited', can_edit: true })];
  });
  const edited = await patch(
    { body: 'edited', name: 'Somebody Else' },
    handlerDeps({ db: updateDb.db }),
    { headers: { cookie: commentTokenCookie(token) } },
  );
  assert.equal(edited.status, 200);
  const editedBody = await jsonOf(edited);
  assert.equal((editedBody.comment as Record<string, unknown>).body, 'edited');
  assert.ok(
    !updated!.values.includes('Somebody Else'),
    'a display name is not editable through the API',
  );
  assert.ok(updated!.values.includes(tokenHash));
  assert.ok(!updated!.values.includes(token));

  // --- deleting --------------------------------------------------------------
  const crossSiteDelete = makeForbiddenDb();
  const crossSiteDeleteResponse = await remove(
    handlerDeps({ db: crossSiteDelete.db }),
    { headers: { origin: 'https://evil.example' } },
  );
  assert.equal(crossSiteDeleteResponse.status, 403);

  const deleteWithoutCookie = await remove(
    handlerDeps({ db: makeForbiddenDb().db }),
  );
  assert.equal(deleteWithoutCookie.status, 403);
  assert.equal((await jsonOf(deleteWithoutCookie)).error, 'not_owned');

  const deleteDb = makeFakeDb((query) =>
    /DELETE FROM comments/.test(query.text) ? [{ id: COMMENT_ID_PRIMARY }] : [],
  );
  const deleted = await remove(handlerDeps({ db: deleteDb.db }), {
    headers: { cookie: commentTokenCookie(token) },
  });
  assert.equal(deleted.status, 200);
  assert.deepEqual(await jsonOf(deleted), { ok: true, removed: 'deleted' });
  assert.match(deleteDb.queries[0].text, /NOT EXISTS/);
  assert.ok(deleteDb.queries[0].values.includes(tokenHash));

  // A comment with replies keeps a content-free placeholder instead.
  const placeholderQueries: string[] = [];
  const placeholderDb = makeFakeDb((query) => {
    placeholderQueries.push(query.text);
    return /DELETE FROM comments/.test(query.text)
      ? []
      : [{ id: COMMENT_ID_PRIMARY }];
  });
  const placeholder = await remove(handlerDeps({ db: placeholderDb.db }), {
    headers: { cookie: commentTokenCookie(token) },
  });
  assert.equal(placeholder.status, 200);
  assert.deepEqual(await jsonOf(placeholder), {
    ok: true,
    removed: 'placeholder',
  });
  assert.match(placeholderQueries[1], /author_name = NULL/);
  assert.match(placeholderQueries[1], /body = NULL/);
  assert.match(placeholderQueries[1], /author_token_hash = NULL/);

  const unavailableDb = makeFakeDb(() => []);
  const unavailable = await remove(handlerDeps({ db: unavailableDb.db }), {
    headers: { cookie: commentTokenCookie(token) },
  });
  assert.equal(unavailable.status, 403);
  assert.equal((await jsonOf(unavailable)).error, 'not_owned');
}

/** The token hash the handler passed to an insert or update. */
export function tokenHashOfInsert(values: unknown[]): unknown {
  const hash = values.find(
    (value) => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value),
  );
  assert.ok(hash, 'the insert must be keyed by a token hash');
  return hash;
}

export async function testCommentStoreSql() {
  // Reading a discussion: published rows only, replies only under a published
  // parent, and ownership decided in SQL and exposed as a boolean.
  const list = makeFakeDb(() => []);
  await listPublishedComments(list.db, COMMENT_SLUG, 'hash');
  assert.equal(list.queries.length, 1);
  const listSql = list.queries[0].text;
  assert.match(listSql, /FROM comments/);
  assert.match(listSql, /status = 'published'/);
  assert.match(listSql, /parent\.status = 'published'/);
  assert.match(listSql, /can_edit/);
  assert.match(listSql, /author_token_hash =/);
  assert.match(listSql, /ORDER BY created_at ASC/);
  assert.ok(!/SELECT \*/.test(listSql));
  assert.deepEqual(list.queries[0].values, [
    'hash',
    EDIT_WINDOW_INTERVAL,
    COMMENT_SLUG,
  ]);

  // Rate limiting counts rows for one identity across every article.
  const count = makeFakeDb(() => [{ recent: 2 }]);
  assert.equal(await countRecentComments(count.db, 'hash'), 2);
  assert.match(count.queries[0].text, /author_token_hash =/);
  assert.ok(count.queries[0].values.includes(RATE_LIMIT_WINDOW_INTERVAL));
  assert.ok(!/post_slug/.test(count.queries[0].text));

  // A top-level comment and a reply are the same guarded insert, so a reply can
  // never point at another article, at a reply, or at a hidden comment.
  const insert = makeFakeDb(() => [makeCommentRow()]);
  const created = await createComment(insert.db, {
    slug: COMMENT_SLUG,
    parentId: null,
    tokenHash: 'hash',
    name: 'Reader',
    body: 'hello',
  });
  assert.equal(created?.id, COMMENT_ID_PRIMARY);
  assert.equal(insert.queries.length, 1);
  assert.match(insert.queries[0].text, /INSERT INTO comments/);
  assert.match(insert.queries[0].text, /IS NULL\s*\n?\s*OR EXISTS/);
  assert.match(insert.queries[0].text, /parent\.parent_id IS NULL/);
  assert.match(insert.queries[0].text, /parent\.post_slug =/);
  assert.deepEqual(insert.queries[0].values.slice(0, 5), [
    COMMENT_SLUG,
    null,
    'hash',
    'Reader',
    'hello',
  ]);
  assert.match(insert.queries[0].text, /'published', FALSE/);
  assert.ok(
    !insert.queries[0].values.includes(true),
    'the public API can never write is_author',
  );

  const rejected = makeFakeDb(() => []);
  assert.equal(
    await createComment(rejected.db, {
      slug: COMMENT_SLUG,
      parentId: COMMENT_ID_PRIMARY,
      tokenHash: 'hash',
      name: 'Reader',
      body: 'hello',
    }),
    null,
  );

  // Editing is limited to the body, to the owner, and to the 30-minute window.
  const update = makeFakeDb(() => [makeCommentRow({ can_edit: true })]);
  assert.ok(
    await updateOwnCommentBody(update.db, {
      id: COMMENT_ID_PRIMARY,
      slug: COMMENT_SLUG,
      tokenHash: 'hash',
      body: 'edited',
    }),
  );
  const updateSql = update.queries[0].text;
  assert.match(updateSql, /SET body =/);
  assert.match(updateSql, /updated_at = now\(\)/);
  assert.match(updateSql, /is_author = FALSE/);
  assert.match(updateSql, /author_token_hash =/);
  assert.match(updateSql, /status = 'published'/);
  assert.ok(!/author_name =/.test(updateSql), 'a name is not editable');
  assert.ok(update.queries[0].values.includes(EDIT_WINDOW_INTERVAL));

  // Deleting a parentless comment removes the row...
  const hardDelete = makeFakeDb(() => [{ id: COMMENT_ID_PRIMARY }]);
  assert.equal(
    await deleteOwnComment(hardDelete.db, {
      id: COMMENT_ID_PRIMARY,
      slug: COMMENT_SLUG,
      tokenHash: 'hash',
    }),
    'deleted',
  );
  assert.equal(hardDelete.queries.length, 1);
  assert.match(hardDelete.queries[0].text, /DELETE FROM comments/);
  assert.match(hardDelete.queries[0].text, /NOT EXISTS/);
  assert.ok(hardDelete.queries[0].values.includes(EDIT_WINDOW_INTERVAL));

  // ...while a comment with replies keeps a placeholder with nothing personal.
  const placeholder = makeFakeDb((query) =>
    /DELETE FROM comments/.test(query.text) ? [] : [{ id: COMMENT_ID_PRIMARY }],
  );
  assert.equal(
    await deleteOwnComment(placeholder.db, {
      id: COMMENT_ID_PRIMARY,
      slug: COMMENT_SLUG,
      tokenHash: 'hash',
    }),
    'placeholder',
  );
  assert.match(
    placeholder.queries[1].text,
    /author_name = NULL, body = NULL, author_token_hash = NULL/,
  );

  const nothing = makeFakeDb(() => []);
  assert.equal(
    await deleteOwnComment(nothing.db, {
      id: COMMENT_ID_PRIMARY,
      slug: COMMENT_SLUG,
      tokenHash: 'hash',
    }),
    'unavailable',
  );

  // Operator reads and status changes.
  const operator = makeFakeDb(() => []);
  await listCommentsForOperator(operator.db, {
    slug: null,
    includeHidden: false,
  });
  assert.match(operator.queries[0].text, /status = 'published'/);
  assert.deepEqual(operator.queries[0].values, [null, null, false]);

  const hide = makeFakeDb(() => [{ id: COMMENT_ID_PRIMARY }]);
  assert.equal(
    await setCommentStatus(hide.db, COMMENT_ID_PRIMARY, 'hidden'),
    true,
  );
  assert.match(hide.queries[0].text, /SET status =/);
  assert.ok(
    !/updated_at/.test(hide.queries[0].text),
    'moderation must not mark a comment as edited',
  );
  assert.deepEqual(hide.queries[0].values, ['hidden', COMMENT_ID_PRIMARY]);
  assert.equal(
    await setCommentStatus(
      makeFakeDb(() => []).db,
      COMMENT_ID_PRIMARY,
      'hidden',
    ),
    false,
  );

  // The operator delete takes the replies with the parent in one statement, and
  // returns the rows it destroyed so the CLI can echo them.
  const cascadeRows = [
    {
      id: COMMENT_ID_PRIMARY,
      post_slug: COMMENT_SLUG,
      parent_id: null,
      author_name: 'Dana',
      body: 'The original comment.',
    },
    {
      id: COMMENT_ID_REPLY,
      post_slug: COMMENT_SLUG,
      parent_id: COMMENT_ID_PRIMARY,
      author_name: 'Evan',
      body: 'A reply that goes with it.',
    },
    {
      id: '33333333-3333-4333-8333-333333333333',
      post_slug: COMMENT_SLUG,
      parent_id: COMMENT_ID_PRIMARY,
      author_name: null,
      body: null,
    },
  ];
  const cascade = makeFakeDb(() => cascadeRows);
  assert.deepEqual(
    await deleteCommentWithReplies(cascade.db, COMMENT_ID_PRIMARY),
    {
      deleted: 3,
      removedReplies: 2,
      removed: cascadeRows,
    },
  );
  assert.equal(cascade.queries.length, 1);
  assert.match(cascade.queries[0].text, /id =.*::uuid OR parent_id =.*::uuid/);
  assert.match(
    cascade.queries[0].text,
    /RETURNING id, post_slug, parent_id, author_name, body/,
  );
  assert.equal(
    await deleteCommentWithReplies(makeFakeDb(() => []).db, COMMENT_ID_PRIMARY),
    null,
  );

  // Author replies are the only way is_author is ever set.
  const reply = makeFakeDb(() => [
    {
      id: COMMENT_ID_REPLY,
      post_slug: COMMENT_SLUG,
      parent_id: COMMENT_ID_PRIMARY,
    },
  ]);
  const authorReply = await createAuthorReply(reply.db, {
    parentId: COMMENT_ID_PRIMARY,
    name: 'Leon',
    body: 'Thanks for reading.',
  });
  assert.equal(authorReply?.post_slug, COMMENT_SLUG);
  const replySql = reply.queries[0].text;
  assert.match(replySql, /'published', TRUE/);
  assert.match(replySql, /parent\.parent_id IS NULL/);
  assert.match(replySql, /parent\.status = 'published'/);
  assert.ok(
    !reply.queries[0].values.includes(true),
    'is_author is written as a literal, not from input',
  );
  assert.deepEqual(reply.queries[0].values, [
    'Leon',
    'Thanks for reading.',
    COMMENT_ID_PRIMARY,
  ]);
}

export function testCommentIntegrationBoundaries() {
  const read = (relativePath: string) =>
    fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf-8');

  // Giscus is fully removed: script, iframe, theme sync, preconnect, and policy.
  const blogPost = read('src/layouts/BlogPost.astro');
  for (const relativePath of [
    'src/layouts/BlogPost.astro',
    'src/components/BaseHead.astro',
    'src/pages/privacy.astro',
  ]) {
    assert.doesNotMatch(
      read(relativePath),
      /giscus/i,
      `${relativePath} must not reference Giscus after the cutover`,
    );
  }

  // Articles stay static: the discussion renders after the newsletter CTA and
  // before related posts.
  const subscribeAt = blogPost.indexOf('<SubscribeForm');
  const discussionAt = blogPost.indexOf('<Discussion');
  const relatedAt = blogPost.indexOf('<!-- Related posts -->');
  assert.ok(
    subscribeAt > 0 && discussionAt > subscribeAt,
    'discussion follows the newsletter CTA',
  );
  assert.ok(relatedAt > discussionAt, 'discussion precedes related posts');
  // The shell is server-rendered, and hydration waits until the reader reaches
  // the section, so article views never pay for the island or a comment fetch
  // they did not ask for.
  assert.match(read('src/components/Discussion.astro'), /client:visible/);
  assert.ok(
    !read('src/components/Discussion.astro').includes('client:load'),
    'the discussion must not hydrate on page load',
  );

  // On-demand API routes only, with the article slug in the path.
  const collectionRoute = read('src/pages/api/comments/[slug]/index.ts');
  assert.match(collectionRoute, /export const prerender = false/);
  assert.match(collectionRoute, /export const GET/);
  assert.match(collectionRoute, /export const POST/);
  const itemRoute = read('src/pages/api/comments/[slug]/[id].ts');
  assert.match(itemRoute, /export const prerender = false/);
  assert.match(itemRoute, /export const PATCH/);
  assert.match(itemRoute, /export const DELETE/);
  // Both routes share the module-level "unconfigured database" adapter instead
  // of each keeping a private copy that can drift.
  for (const route of [collectionRoute, itemRoute]) {
    assert.match(route, /import \{ tryNeonDb \} from '.*lib\/neon\.ts'/);
    assert.ok(
      !route.includes('function tryNeonDb'),
      'the null-database adapter must live in src/lib/neon.ts',
    );
  }

  // One table, with the constraints the application relies on.
  const migration = read('migrations/comments/001_initial.sql');
  assert.equal(
    migration.match(/CREATE TABLE/g)?.length,
    1,
    'the discussion stays one table',
  );
  for (const fragment of [
    'id UUID PRIMARY KEY',
    'is_author BOOLEAN NOT NULL DEFAULT FALSE',
    "CHECK (status IN ('published', 'hidden'))",
    'char_length(body) BETWEEN 1 AND 3000',
    'author_token_hash IS NOT NULL OR is_author',
  ]) {
    assert.ok(migration.includes(fragment), `migration must keep ${fragment}`);
  }
  // Re-running the migration is a no-op instead of an error, so an operator who
  // applies it twice does not silently end up with a half-applied schema.
  assert.equal(
    migration.match(/CREATE (TABLE|INDEX) IF NOT EXISTS/g)?.length,
    4,
    'every object in the discussion migration is created conditionally',
  );

  // The island never trusts client-side input for the privileged field, and
  // posts exactly the fields the API expects.
  const island = read('src/components/DiscussionIsland.tsx');
  assert.ok(
    !island.includes('is_author'),
    'the island cannot set the author field',
  );
  assert.ok(!island.includes('dangerouslySetInnerHTML'));
  assert.ok(
    !island.includes('innerHTML'),
    'comment text is only ever rendered as a text node',
  );
  assert.match(island, /name="website"/, 'the honeypot field must exist');
  assert.match(island, /discussion-honeypot/);
  assert.match(island, /parentId: replyTo\?\.id \?\? null/);
  assert.match(island, /turnstileToken: verificationToken\.current/);
  // The widget bootstrap is shared with the contact form, so a fix to either
  // caller's loading behaviour cannot drift out of the other.
  assert.match(island, /loadTurnstileScript\(renderWidget\)/);
  assert.match(island, /website: honeypot/);
  assert.match(island, /No comments yet\. Add the first one\./);
  // A list that failed to load says how to retry. A failed post must not, because
  // a refresh would discard the draft, so only the no-site-key placeholder keeps
  // the configuration-error wording.
  assert.match(
    island,
    /'Comments could not be loaded\. Refresh the page to try again\.'/,
  );
  assert.match(island, /loadState === 'error'[\s\S]{0,60}LOAD_FAILED/);
  assert.equal(
    island.match(/\{UNAVAILABLE\}/g)?.length,
    1,
    'the no-site-key placeholder is the only remaining use of the unavailable message',
  );
  assert.match(
    island,
    /Discussion\{total > 0 \? ` · \$\{total\}` : ''\}/,
    'the count appears only once comments exist',
  );
  assert.match(island, /role="status" aria-live="polite"/);
  assert.match(island, /prefer a private conversation/i);
  assert.ok(
    !/\b0 comments\b/i.test(island),
    'an empty discussion never renders "0 comments"',
  );

  // The default state is the section the design specifies: heading, prompt,
  // invitation, display name, body, post, private link.
  assert.match(island, /class="discussion-prompt"/);
  assert.match(
    island,
    /Thoughtful disagreements, additional evidence, and different ways of looking at the problem are welcome\./,
  );
  assert.match(island, /<label for="discussion-name">Display name<\/label>/);
  assert.match(island, /placeholder="Add to the discussion…"/);

  // Every form posts, so a browser that submits without JavaScript can never put
  // comment text in the URL, the history, or a server access log.
  assert.equal(island.match(/<form[^>]*method="post"/g)?.length, 2);
  assert.equal(island.match(/<form/g)?.length, 2);

  // A request that never answers must not leave the reader in a submitted state
  // forever, and an unanswered post reloads the list before a retry.
  assert.match(island, /signal: AbortSignal\.timeout\(REQUEST_TIMEOUT_MS\)/);
  assert.equal(
    island.match(/signal: AbortSignal\.timeout\(REQUEST_TIMEOUT_MS\)/g)?.length,
    2,
    'both the list and the mutations are bounded',
  );
  assert.match(island, /if \(!result\.data\) void load\(\);/);

  // The loading state reserves space so the article does not jump.
  const globalCss = read('src/styles/global.css');
  assert.match(globalCss, /\.discussion-list \{[\s\S]*?min-height/);
  assert.match(globalCss, /\.discussion-prompt \{/);

  // Local-only moderation tooling.
  const packageJson = JSON.parse(read('package.json')) as {
    scripts: Record<string, string>;
  };
  for (const name of [
    'comments:list',
    'comments:hide',
    'comments:restore',
    'comments:delete',
    'comments:reply',
  ]) {
    assert.ok(packageJson.scripts[name], `package.json is missing ${name}`);
    assert.match(packageJson.scripts[name], /scripts\/comments\//);
  }
  assert.ok(fs.existsSync(path.join(REPO_ROOT, 'docs/discussion.md')));
}

export async function runDiscussionTests() {
  await testCommentDomain();
  await testCommentTokens();
  await testCommentDisplay();
  await testCommentTurnstile();
  await testCommentHandlers();
  await testCommentStoreSql();
  await testCommentIntegrationBoundaries();
}
