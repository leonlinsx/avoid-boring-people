// Opt-in integration test against a disposable local Postgres cluster only.
// COMMENTS_TEST_PG_SOCKET must be a private /tmp directory; never uses DATABASE_URL.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import {
  createAuthorReply,
  createComment,
  countRecentComments,
  deleteCommentWithReplies,
  deleteOwnComment,
  listCommentsForOperator,
  listPublishedComments,
  setCommentStatus,
  updateOwnCommentBody,
} from '../src/lib/comments/store.ts';
import type { NeonDb } from '../src/lib/neon.ts';

const socket = process.env.COMMENTS_TEST_PG_SOCKET;
assert.match(socket ?? '', /^\/tmp\/comments-pg-[A-Za-z0-9]+$/);
const SCHEMA = 'comments_integration_test';

function psql(query: string): string {
  return execFileSync(
    'psql',
    [
      '-X',
      '-h',
      socket!,
      '-p',
      '55440',
      '-d',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
      '-At',
      '-c',
      query,
    ],
    {
      input: '',
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        PATH: process.env.PATH,
        PGOPTIONS: `-c search_path=${SCHEMA},public`,
      },
    },
  ).trim();
}

function literal(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number') return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}

// Tagged-template shim with the same shape as the Neon driver: it returns the
// statement's rows, so store functions are exercised unchanged. The statement is
// wrapped in a CTE so data-modifying RETURNING queries can be aggregated too.
const db = (async (parts: TemplateStringsArray, ...values: unknown[]) => {
  const statement = parts.reduce(
    (sql, part, index) =>
      sql + part + (index < values.length ? literal(values[index]) : ''),
    '',
  );
  const json = psql(
    `WITH result AS (${statement}) SELECT coalesce(json_agg(row_to_json(result)), '[]'::json)::text FROM result`,
  );
  return JSON.parse(json || '[]') as unknown[];
}) as unknown as NeonDb;

const SLUG = 'postgres-integration-article';
const OTHER_SLUG = 'another-postgres-article';
const TOKEN_A = 'a'.repeat(64);
const TOKEN_B = 'b'.repeat(64);
const randomId = () => psql('SELECT gen_random_uuid()');
const backdate = (id: string, interval: string) =>
  psql(
    `UPDATE comments SET created_at = now() - ${literal(interval)}::interval WHERE id = ${literal(id)}::uuid`,
  );

async function main() {
  psql(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
  psql(`CREATE SCHEMA ${SCHEMA}`);
  psql(
    readFileSync(
      new URL('../migrations/comments/001_initial.sql', import.meta.url),
      'utf8',
    ),
  );

  // create top-level comment, create reply
  const root = await createComment(db, {
    slug: SLUG,
    parentId: null,
    tokenHash: TOKEN_A,
    name: 'Ada',
    body: 'First comment',
  });
  assert.ok(root, 'a top-level comment must be insertable');
  assert.equal(root.parent_id, null);
  assert.equal(root.is_author, false);

  const reply = await createComment(db, {
    slug: SLUG,
    parentId: root.id,
    tokenHash: TOKEN_B,
    name: 'Grace',
    body: 'A reply',
  });
  assert.ok(reply, 'a reply must be insertable');
  assert.equal(reply.parent_id, root.id);

  // parent must be top-level
  assert.equal(
    await createComment(db, {
      slug: SLUG,
      parentId: reply.id,
      tokenHash: TOKEN_A,
      name: 'Ada',
      body: 'reply to a reply',
    }),
    null,
    'replying to a reply must be refused by SQL',
  );

  // parent belongs to same slug
  const elsewhere = await createComment(db, {
    slug: OTHER_SLUG,
    parentId: null,
    tokenHash: TOKEN_A,
    name: 'Ada',
    body: 'Different article',
  });
  assert.ok(elsewhere);
  assert.equal(
    await createComment(db, {
      slug: SLUG,
      parentId: elsewhere.id,
      tokenHash: TOKEN_A,
      name: 'Ada',
      body: 'cross-article reply',
    }),
    null,
    'a parent from another article must be refused',
  );

  // invalid UUID
  await assert.rejects(() =>
    createComment(db, {
      slug: SLUG,
      parentId: 'not-a-uuid',
      tokenHash: TOKEN_A,
      name: 'Ada',
      body: 'bad parent',
    }),
  );

  // hidden comments excluded, including replies whose parent was hidden
  const hiddenRoot = await createComment(db, {
    slug: SLUG,
    parentId: null,
    tokenHash: TOKEN_B,
    name: 'Grace',
    body: 'About to be hidden',
  });
  assert.ok(hiddenRoot);
  const hiddenReply = await createComment(db, {
    slug: SLUG,
    parentId: hiddenRoot.id,
    tokenHash: TOKEN_A,
    name: 'Ada',
    body: 'Reply to a hidden comment',
  });
  assert.ok(hiddenReply);
  assert.equal(await setCommentStatus(db, hiddenRoot.id, 'hidden'), true);
  const visibleIds = (await listPublishedComments(db, SLUG, null)).map(
    (row) => row.id,
  );
  assert.ok(
    !visibleIds.includes(hiddenRoot.id) && !visibleIds.includes(hiddenReply.id),
    'a hidden parent must take its replies out of public view',
  );
  assert.ok(visibleIds.includes(root.id) && visibleIds.includes(reply.id));

  // operator view sees what the public cannot
  const operatorRows = await listCommentsForOperator(db, {
    slug: SLUG,
    includeHidden: true,
  });
  const hiddenRow = operatorRows.find((row) => row.id === hiddenRoot.id);
  assert.equal(hiddenRow?.status, 'hidden');
  assert.equal(hiddenRow?.has_owner, true);
  assert.equal(
    new Date(hiddenRow?.updated_at ?? 0).getTime(),
    new Date(hiddenRoot.updated_at).getTime(),
    'moderation must not mark a comment as edited',
  );
  assert.equal(
    (
      await listCommentsForOperator(db, {
        slug: SLUG,
        includeHidden: false,
      })
    ).some((row) => row.id === hiddenRoot.id),
    false,
  );

  // ownership: only the creating token sees can_edit, and only inside the window
  const forA = await listPublishedComments(db, SLUG, TOKEN_A);
  const forB = await listPublishedComments(db, SLUG, TOKEN_B);
  assert.equal(forA.find((row) => row.id === root.id)?.can_edit, true);
  assert.equal(forB.find((row) => row.id === root.id)?.can_edit, false);
  backdate(root.id, '31 minutes');
  assert.equal(
    (await listPublishedComments(db, SLUG, TOKEN_A)).find(
      (row) => row.id === root.id,
    )?.can_edit,
    false,
    'the edit window must be decided by the database clock',
  );

  // rate limiting counts this browser identity across articles; hidden comments
  // still count, while a comment older than the window does not. `root` is
  // already 31 minutes old and `hiddenReply` is hidden: A has 2, B has 2.
  assert.equal(await countRecentComments(db, TOKEN_A), 2);
  assert.equal(await countRecentComments(db, TOKEN_B), 2);
  backdate(hiddenReply.id, '11 minutes');
  assert.equal(await countRecentComments(db, TOKEN_A), 1);

  // owner edits own comment; author comments are untouchable from the API path
  assert.equal(
    await updateOwnCommentBody(db, {
      id: elsewhere.id,
      slug: OTHER_SLUG,
      tokenHash: TOKEN_B,
      body: 'stolen',
    }),
    null,
    'another browser token cannot edit a comment',
  );
  assert.equal(
    await updateOwnCommentBody(db, {
      id: root.id,
      slug: SLUG,
      tokenHash: TOKEN_A,
      body: 'too late',
    }),
    null,
    'an expired window must reject the edit',
  );
  const edited = await updateOwnCommentBody(db, {
    id: elsewhere.id,
    slug: OTHER_SLUG,
    tokenHash: TOKEN_A,
    body: 'Edited body',
  });
  assert.equal(edited?.body, 'Edited body');
  assert.ok(edited && edited.updated_at >= edited.created_at);

  const authorReply = await createAuthorReply(db, {
    parentId: elsewhere.id,
    name: 'Leon',
    body: 'Thanks for reading.',
  });
  assert.ok(authorReply);
  assert.equal(authorReply.post_slug, OTHER_SLUG);
  assert.equal(
    await psql(
      `SELECT is_author || ':' || (author_token_hash IS NULL) FROM comments WHERE id = ${literal(authorReply.id)}::uuid`,
    ),
    'true:true',
    'an author reply must be marked and must own no token',
  );
  assert.equal(
    await updateOwnCommentBody(db, {
      id: authorReply.id,
      slug: OTHER_SLUG,
      tokenHash: TOKEN_A,
      body: 'impersonating the author',
    }),
    null,
  );
  assert.equal(
    await createAuthorReply(db, {
      parentId: reply.id,
      name: 'Leon',
      body: 'Reply to a reply',
    }),
    null,
    'author replies are also limited to top-level parents',
  );
  assert.equal(
    await createAuthorReply(db, {
      parentId: hiddenRoot.id,
      name: 'Leon',
      body: 'Reply to a hidden comment',
    }),
    null,
  );

  // deletion: hard delete without replies, placeholder with replies
  const lonely = await createComment(db, {
    slug: SLUG,
    parentId: null,
    tokenHash: TOKEN_B,
    name: 'Grace',
    body: 'No replies here',
  });
  assert.ok(lonely);
  assert.equal(
    await deleteOwnComment(db, {
      id: lonely.id,
      slug: SLUG,
      tokenHash: TOKEN_B,
    }),
    'deleted',
  );
  assert.equal(
    await psql(
      `SELECT count(*) FROM comments WHERE id = ${literal(lonely.id)}::uuid`,
    ),
    '0',
  );
  assert.equal(
    await deleteOwnComment(db, {
      id: elsewhere.id,
      slug: OTHER_SLUG,
      tokenHash: TOKEN_B,
    }),
    'unavailable',
    'another browser token cannot delete a comment',
  );
  assert.equal(
    await deleteOwnComment(db, {
      id: elsewhere.id,
      slug: OTHER_SLUG,
      tokenHash: TOKEN_A,
    }),
    'placeholder',
    'a comment with a reply must become a content-free placeholder',
  );
  assert.equal(
    await psql(
      `SELECT (author_name IS NULL) || ':' || (body IS NULL) || ':' || (author_token_hash IS NULL) FROM comments WHERE id = ${literal(elsewhere.id)}::uuid`,
    ),
    'true:true:true',
    'the placeholder must keep its thread but lose every identity field',
  );
  assert.equal(
    await deleteOwnComment(db, {
      id: elsewhere.id,
      slug: OTHER_SLUG,
      tokenHash: TOKEN_A,
    }),
    'unavailable',
    'a placeholder cannot be deleted twice',
  );
  const replaced = await createComment(db, {
    slug: SLUG,
    parentId: null,
    tokenHash: TOKEN_A,
    name: 'Ada',
    body: 'About to expire',
  });
  assert.ok(replaced);
  backdate(replaced.id, '31 minutes');
  assert.equal(
    await deleteOwnComment(db, {
      id: replaced.id,
      slug: SLUG,
      tokenHash: TOKEN_A,
    }),
    'unavailable',
    'the delete window must be decided by the database clock',
  );

  // operator delete cascades to replies
  const cascadeRoot = await createComment(db, {
    slug: SLUG,
    parentId: null,
    tokenHash: TOKEN_A,
    name: 'Ada',
    body: 'Cascade root',
  });
  assert.ok(cascadeRoot);
  for (const body of ['first reply', 'second reply']) {
    assert.ok(
      await createComment(db, {
        slug: SLUG,
        parentId: cascadeRoot.id,
        tokenHash: TOKEN_B,
        name: 'Grace',
        body,
      }),
    );
  }
  const cascadeDelete = await deleteCommentWithReplies(db, cascadeRoot.id);
  assert.equal(cascadeDelete?.deleted, 3);
  assert.equal(cascadeDelete?.removedReplies, 2);
  // The CLI echoes exactly what was destroyed.
  assert.deepEqual(
    cascadeDelete?.removed
      .map((row) => [row.post_slug, row.author_name, row.body])
      .sort(),
    [
      [SLUG, 'Ada', 'Cascade root'],
      [SLUG, 'Grace', 'first reply'],
      [SLUG, 'Grace', 'second reply'],
    ].sort(),
  );
  assert.equal(
    await psql(
      `SELECT count(*) FROM comments WHERE id = ${literal(cascadeRoot.id)}::uuid OR parent_id = ${literal(cascadeRoot.id)}::uuid`,
    ),
    '0',
  );
  assert.equal(await deleteCommentWithReplies(db, randomId()), null);

  // constraints hold even for writers that bypass application validation
  const tooLongSlug = 'x'.repeat(121);
  const rejects = (label: string, run: () => unknown) =>
    assert.throws(run, label);
  rejects('slug length', () =>
    psql(
      `INSERT INTO comments (post_slug, author_token_hash, author_name, body) VALUES (${literal(tooLongSlug)}, 'hash', 'Ada', 'body')`,
    ),
  );
  rejects('empty body', () =>
    psql(
      `INSERT INTO comments (post_slug, author_token_hash, author_name, body) VALUES ('slug', 'hash', 'Ada', '')`,
    ),
  );
  rejects('body length', () =>
    psql(
      `INSERT INTO comments (post_slug, author_token_hash, author_name, body) VALUES ('slug', 'hash', 'Ada', ${literal('x'.repeat(3001))})`,
    ),
  );
  rejects('name length', () =>
    psql(
      `INSERT INTO comments (post_slug, author_token_hash, author_name, body) VALUES ('slug', 'hash', ${literal('x'.repeat(61))}, 'body')`,
    ),
  );
  rejects('status', () =>
    psql(
      `INSERT INTO comments (post_slug, author_token_hash, author_name, body, status) VALUES ('slug', 'hash', 'Ada', 'body', 'spam')`,
    ),
  );
  rejects('content state', () =>
    psql(
      `INSERT INTO comments (post_slug, author_token_hash, body) VALUES ('slug', 'hash', 'body')`,
    ),
  );
  rejects('tokenless non-author comment', () =>
    psql(
      `INSERT INTO comments (post_slug, author_name, body) VALUES ('slug', 'Ada', 'body')`,
    ),
  );
  rejects('foreign key', () =>
    psql(
      `INSERT INTO comments (post_slug, parent_id, author_token_hash, author_name, body) VALUES ('slug', ${literal(randomId())}::uuid, 'hash', 'Ada', 'body')`,
    ),
  );
  rejects('parent is not self', () =>
    psql(
      `UPDATE comments SET parent_id = id WHERE id = ${literal(root.id)}::uuid`,
    ),
  );
  psql(
    `INSERT INTO comments (post_slug, author_name, body, is_author) VALUES ('slug', 'Leon', 'authored', TRUE)`,
  );

  console.log(
    'Comments Postgres integration checks passed (threading, visibility, ownership window, rate counting, placeholder delete, cascade, constraints).',
  );
}

try {
  await main();
} finally {
  psql(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
}
