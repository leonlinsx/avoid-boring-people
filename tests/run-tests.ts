import assert from 'node:assert/strict';
import { __setMockGetCollectionImplementation, z } from 'astro:content';
import { SITE_URL, SITE_AUTHOR_SAME_AS } from '../src/consts.ts';
import {
  computeCleanSlug,
  normalizePathname,
} from '../src/utils/slug-helpers.ts';
import { searchPosts, normalizeQuery } from '../src/utils/search.ts';
import {
  enrichPost,
  getAllPostsPaginated,
  getCategoryPostsPaginated,
  normalizeCategory,
  setGetCollectionImplementation,
  titleCase,
  type BlogPost,
} from '../src/utils/text.ts';
import { categoryLabel } from '../src/utils/taxonomy.ts';
import { extractHeadings } from '../src/utils/toc.ts';
import { normalizeHeroImage } from '../src/utils/hero.ts';
import { buildPaginationHref } from '../src/utils/pagination.ts';
import {
  canAutomaticallyTransition,
  mapSubstackRow,
  normalizeEmail,
} from '../src/lib/newsletter/domain.ts';
import { hashToken } from '../src/lib/newsletter/tokens.ts';
import {
  hashRateLimitSubject,
  isRateLimitAllowed,
} from '../src/lib/newsletter/rate-limit.ts';
import {
  GMAIL_CLIP_LIMIT_BYTES,
  NewsletterRenderError,
  renderNewsletterEmail,
} from '../src/lib/newsletter/render.ts';
import { assertAllowedTestRecipient } from '../src/lib/newsletter/test-send.ts';
import {
  importTimestamp,
  planSubstackImport,
} from '../src/lib/newsletter/importer.ts';
import {
  assertRecipientScope,
  assertSesAccountReady,
  productionSendConfig,
  subscriberUnsubscribeToken,
} from '../src/lib/newsletter/production-send.ts';
import {
  buildConfirmInvalidPage,
  buildConfirmSuccessPage,
} from '../src/lib/newsletter/confirm-pages.ts';
import {
  buildConfirmationEmail,
  canDeliverConfirmation,
  CONFIRMATION_SUBJECT,
  confirmSubscription,
  requestSubscription,
} from '../src/lib/newsletter/subscriptions.ts';
import {
  confirmSnsSubscription,
  parseSnsEnvelope,
  signingString,
  verifySnsEnvelope,
} from '../src/lib/newsletter/sns.ts';
import {
  hasUntrustedPathOverride,
  requiresOriginRejection,
} from '../src/lib/newsletter/request-origin.ts';
import { serializeJsonLd } from '../src/utils/jsonld.ts';
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
} from '../src/lib/comments/domain.ts';
import {
  COMMENT_TOKEN_COOKIE,
  commentTokenCookie,
  createCommentToken,
  hashCommentToken,
  isCommentTokenShape,
  readCommentToken,
} from '../src/lib/comments/tokens.ts';
import {
  handleCreateComment,
  handleDeleteComment,
  handleListComments,
  handleUpdateComment,
  MAX_COMMENT_REQUEST_BYTES,
  type CommentHandlerDeps,
} from '../src/lib/comments/handlers.ts';
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
} from '../src/lib/comments/store.ts';
import {
  commentCount,
  formatCommentTimestamp,
  groupCommentThreads,
  isEdited,
} from '../src/lib/comments/display.ts';
import {
  TURNSTILE_VERIFY_URL,
  turnstileSiteKey,
  verifyTurnstile,
  warnIfSiteKeyMissing,
} from '../src/lib/comments/turnstile.ts';
import {
  canonicalSiteOrigin,
  isSameSiteRequest,
} from '../src/lib/site-origin.ts';

import {
  BLOG_CONTENT_DIR,
  LEGACY_ARTICLE_ALIASES,
  STATIC_LASTMOD,
  buildBlogLastmodMap,
  buildLegacyArticleRedirects,
  readArticleRoutes,
  resolveLastmod,
  serializeSitemapItem,
} from '../src/utils/article-routes.ts';
import { createHash, createSign, generateKeyPairSync } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception', error);
  process.exitCode = 1;
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled rejection', reason);
  process.exitCode = 1;
});

function makePost(overrides: Record<string, any> = {}) {
  const base = {
    id: '2024_01_01_sample/index.md',
    slug: 'sample',
    body: 'Base body',
    collection: 'blog',
    data: {
      title: 'Base Title',
      description: 'Base description about finance',
      pubDate: new Date('2024-01-01T00:00:00Z'),
      updatedDate: undefined,
      category: 'Investing',
      categoryNormalized: 'investing',
      readingTime: 3,
      tags: ['compounding'],
      heroImage: undefined,
    },
  };

  return {
    ...base,
    ...overrides,
    data: {
      ...base.data,
      ...(overrides.data ?? {}),
    },
  };
}

function makeCollectionEntry(overrides: Record<string, any> = {}) {
  const base = {
    id: '2024_01_01_sample/index.md',
    slug: 'sample',
    body: 'Sample body for reading time calculations.',
    collection: 'blog',
    data: {
      title: 'Sample Title',
      description: 'Sample description',
      pubDate: new Date('2024-01-01T00:00:00Z'),
      updatedDate: undefined,
      category: 'Investing',
      tags: ['markets'],
      heroImage: undefined,
    },
  };

  return {
    ...base,
    ...overrides,
    data: {
      ...base.data,
      ...(overrides.data ?? {}),
    },
  };
}

function makeEntry(overrides: Record<string, any> = {}) {
  const base = {
    id: '2024_01_01_sample/index.md',
    data: {},
  };

  return {
    ...base,
    ...overrides,
    data: {
      ...(base.data ?? {}),
      ...(overrides.data ?? {}),
    },
  };
}

function testSearchPosts() {
  const posts = [
    makePost(),
    makePost({ id: '2024_01_02_other/index.md', slug: 'other' }),
  ];
  assert.deepEqual(searchPosts(posts as any, '   '), posts);

  const shuffled = searchPosts(posts as any, 'base');
  assert.deepEqual(
    shuffled.map((p) => p.id),
    posts.map((p) => p.id),
  );

  const detailedPosts = [
    makePost({
      id: '2024_01_02_growth/index.md',
      slug: 'growth',
      data: {
        title: 'Growth Stocks',
        description: 'Looking at multiples',
        category: 'Markets',
        tags: ['Equities'],
      },
      body: 'This essay analyses venture capital deal flow.',
    }),
    makePost({
      id: '2024_01_03_notes/index.md',
      slug: 'notes',
      data: {
        title: 'Weekly Notes',
        description: 'Digest',
        category: 'Notes',
        tags: ['newsletter'],
      },
      body: 'miscellaneous thoughts',
    }),
  ];

  assert.deepEqual(searchPosts(detailedPosts as any, 'venture'), [
    detailedPosts[0],
  ]);
  assert.deepEqual(searchPosts(detailedPosts as any, 'markets'), [
    detailedPosts[0],
  ]);
  assert.deepEqual(searchPosts(detailedPosts as any, 'equities'), [
    detailedPosts[0],
  ]);
  assert.deepEqual(searchPosts(detailedPosts as any, 'digest'), [
    detailedPosts[1],
  ]);
  assert.deepEqual(searchPosts(detailedPosts as any, 'venture capital'), [
    detailedPosts[0],
  ]);
  assert.equal(searchPosts(detailedPosts as any, 'nonexistent').length, 0);
}

function testComputeCleanSlug() {
  assert.equal(
    computeCleanSlug(makeEntry({ data: { slug: 'custom-slug' } })),
    'custom-slug',
  );
  assert.equal(
    computeCleanSlug(makeEntry({ id: '2024_02_03_new-idea.md' })),
    'new-idea',
  );
  assert.equal(
    computeCleanSlug(makeEntry({ id: '2024_02_03_new-idea/index.md' })),
    'new-idea',
  );
  assert.equal(
    computeCleanSlug(makeEntry({ id: '2024_02_03_new-idea/index.mdx' })),
    'new-idea',
  );
  assert.equal(
    computeCleanSlug(makeEntry({ data: { slug: '  /custom-slug/ ' } })),
    'custom-slug',
  );
}

function testNormalizeQuery() {
  assert.equal(normalizeQuery('   Venture   Deals  '), 'venture deals');
  assert.equal(normalizeQuery('\n\t  MIXED Case  '), 'mixed case');
}

function testBuildPaginationHref() {
  assert.equal(buildPaginationHref(1), '/writing/1');
  assert.equal(buildPaginationHref(2), '/writing/2');
  assert.equal(
    buildPaginationHref(1, 'finance'),
    '/writing/category/finance/1',
  );
  assert.equal(
    buildPaginationHref(5, 'markets & money'),
    '/writing/category/markets%20%26%20money/5',
  );
  assert.equal(
    buildPaginationHref(0, 'finance'),
    '/writing/category/finance/1',
  );
  assert.equal(buildPaginationHref(3.7), '/writing/3');
}

function testTitleCase() {
  assert.equal(titleCase('hello world'), 'Hello World');
  assert.equal(titleCase('multi\nline text'), 'Multi\nLine Text');
  assert.equal(titleCase(''), '');
  assert.equal(titleCase(undefined as any), '');
}

function testNormalizeCategory() {
  assert.equal(normalizeCategory('Investing'), 'investing');
  assert.equal(
    normalizeCategory('Risk & Decision Making'),
    'risk-decision-making',
  );
  assert.equal(normalizeCategory(undefined as any), '');
  assert.equal(categoryLabel('system-design'), 'System Design');
}

function testNewsletterDomain() {
  assert.equal(normalizeEmail('  Reader@Example.COM '), 'reader@example.com');
  assert.equal(normalizeEmail('not-an-email'), null);
  assert.equal(canAutomaticallyTransition('pending', 'active'), true);
  assert.equal(canAutomaticallyTransition('unsubscribed', 'active'), false);
  assert.equal(canAutomaticallyTransition('bounced', 'active'), false);

  assert.equal(
    mapSubstackRow({ Email: 'author@example.com', Type: 'Author' }),
    null,
  );
  assert.deepEqual(
    mapSubstackRow({
      Email: ' Reader@Example.com ',
      Name: 'Reader',
      Type: 'Free',
      'Expiration date': 'Paused',
    }),
    {
      email: 'reader@example.com',
      name: 'Reader',
      status: 'active',
      originalSubscribedAt: null,
      legacySubstackType: 'Free',
      legacySubstackCancelDate: null,
      consentProvenance: 'substack_export',
    },
  );
  assert.equal(
    mapSubstackRow({
      Email: 'cancelled@example.com',
      'Cancel date': '2024-01-01',
    })?.status,
    'unsubscribed',
  );
}

function testNewsletterImporter() {
  const csv = `Email,Name,Type,Subscribed at,Cancel date,Expiration date
author@example.test,Author,Author,2020-01-01,,
active@example.test,Active,Free,2021-01-01,,
duplicate@example.test,Duplicate,Free,2021-03-01,,
Duplicate@Example.Test,Duplicate,Free,2021-03-01,2022-03-01,
paused@example.test,Paused,Free,2021-04-01,,Paused`;
  const plan = planSubstackImport(csv);
  assert.deepEqual(plan.summary, {
    sourceRows: 5,
    excludedRows: 1,
    mappedRows: 4,
    uniqueEmails: 3,
    duplicateEmails: 1,
    active: 2,
    suppressed: 1,
  });
  assert.equal(
    plan.subscribers.find(
      (subscriber) => subscriber.email === 'duplicate@example.test',
    )?.status,
    'unsubscribed',
  );
  assert.equal(
    plan.subscribers.find(
      (subscriber) => subscriber.email === 'paused@example.test',
    )?.status,
    'active',
  );
  assert.equal(importTimestamp('2021-01-01'), '2021-01-01T00:00:00.000Z');
  assert.equal(importTimestamp('not-a-date'), null);
}

function testNewsletterRenderer() {
  const input = {
    articleId: '2021_01_06_nonviolent/index.md',
    title: 'Newsletter test',
    markdown:
      '---\ntitle: Newsletter test\n---\n\n[Site](/writing/test/)\n\n![Post](./n_1.webp)',
    unsubscribeUrl:
      'https://leonlins.com/api/newsletter/unsubscribe?token=preview',
    privacyUrl: 'https://leonlins.com/privacy/',
  };
  const rendered = renderNewsletterEmail(input);
  assert.match(rendered.html, /https:\/\/leonlins\.com\/writing\/test\//);
  assert.match(
    rendered.html,
    /https:\/\/leonlins\.com\/newsletter-assets\/2021_01_06_nonviolent\/n_1\.webp/,
  );
  assert.match(rendered.html, /max-width:100%/);
  assert.equal(
    rendered.headers['List-Unsubscribe-Post'],
    'List-Unsubscribe=One-Click',
  );
  assert.match(rendered.text, /Newsletter test/);
  assert.doesNotMatch(rendered.html, /123 Example Street/);
  assert.equal(
    rendered.headers['List-Unsubscribe'],
    '<https://leonlins.com/api/newsletter/unsubscribe?token=preview>',
  );
  const external = renderNewsletterEmail({
    ...input,
    markdown: '[External](https://example.com/path)',
  });
  assert.match(external.html, /href="https:\/\/example\.com\/path"/);
  assert.throws(
    () =>
      renderNewsletterEmail({ ...input, markdown: '[relative](./private)' }),
    NewsletterRenderError,
  );
  assert.throws(
    () =>
      renderNewsletterEmail({
        ...input,
        markdown: '![Missing](./does-not-exist.webp)',
      }),
    /does not exist/,
  );
  assert.throws(
    () => renderNewsletterEmail({ ...input, markdown: '<NewsletterWidget />' }),
    /MDX/,
  );
  assert.throws(
    () =>
      renderNewsletterEmail({
        ...input,
        markdown: '![Local](https://localhost/private.png)',
      }),
    /public HTTPS/,
  );
  assert.throws(
    () =>
      renderNewsletterEmail({
        ...input,
        markdown: '<iframe src="https://example.com"></iframe>',
      }),
    NewsletterRenderError,
  );
  assert.throws(
    () =>
      renderNewsletterEmail({
        ...input,
        markdown: 'x'.repeat(GMAIL_CLIP_LIMIT_BYTES),
      }),
    /100 KB/,
  );
}

function testNewsletterTestSendSafeguard() {
  assert.equal(
    assertAllowedTestRecipient(
      ' Contact@LeonLins.com ',
      'contact@leonlins.com',
    ),
    'contact@leonlins.com',
  );
  assert.throws(
    () =>
      assertAllowedTestRecipient('reader@example.com', 'contact@leonlins.com'),
    /No email was sent/,
  );
}

function testNewsletterProductionSendSafeguards() {
  const env = {
    NEWSLETTER_ENVIRONMENT: 'production',
    AWS_REGION: 'us-east-2',
    SES_CONFIGURATION_SET: 'newsletter-events',
    NEWSLETTER_MAX_PRODUCTION_RECIPIENTS: '250',
    NEWSLETTER_UNSUBSCRIBE_SECRET: 'a-secure-test-secret-with-32-bytes-minimum',
  } as NodeJS.ProcessEnv;
  assert.deepEqual(productionSendConfig(env), {
    awsRegion: 'us-east-2',
    configurationSet: 'newsletter-events',
    maxRecipients: 250,
    unsubscribeSecret: env.NEWSLETTER_UNSUBSCRIBE_SECRET,
  });
  assert.throws(
    () => productionSendConfig({ ...env, NEWSLETTER_ENVIRONMENT: 'preview' }),
    /No email was sent/,
  );
  assert.throws(
    () =>
      productionSendConfig({ ...env, NEWSLETTER_UNSUBSCRIBE_SECRET: 'short' }),
    /No email was sent/,
  );
  assert.doesNotThrow(() => assertRecipientScope(25, 25, 250));
  assert.throws(() => assertRecipientScope(25, 26, 250), /No email was sent/);
  assert.throws(() => assertRecipientScope(251, 251, 250), /No email was sent/);
  assert.throws(
    () =>
      assertSesAccountReady(
        { productionAccessEnabled: false, sendingEnabled: true },
        1,
      ),
    /production access/,
  );
  assert.throws(
    () =>
      assertSesAccountReady(
        {
          productionAccessEnabled: true,
          sendingEnabled: true,
          max24HourSend: 100,
          sentLast24Hours: 99,
          maxSendRate: 1,
        },
        2,
      ),
    /quota/,
  );
  assert.deepEqual(
    assertSesAccountReady(
      {
        productionAccessEnabled: true,
        sendingEnabled: true,
        max24HourSend: 100,
        sentLast24Hours: 1,
        maxSendRate: 2,
      },
      2,
    ),
    { delayMs: 500 },
  );
  const first = subscriberUnsubscribeToken(
    'subscriber-id',
    env.NEWSLETTER_UNSUBSCRIBE_SECRET!,
  );
  assert.equal(
    first,
    subscriberUnsubscribeToken(
      'subscriber-id',
      env.NEWSLETTER_UNSUBSCRIBE_SECRET!,
    ),
  );
  assert.notEqual(
    first,
    subscriberUnsubscribeToken('other-id', env.NEWSLETTER_UNSUBSCRIBE_SECRET!),
  );
  assert.doesNotMatch(first, /subscriber-id/);
}

function testNewsletterSafetyHelpers() {
  assert.equal(
    hashToken('confirmation-token'),
    hashToken('confirmation-token'),
  );
  assert.notEqual(hashToken('confirmation-token'), 'confirmation-token');
  assert.equal(
    hashRateLimitSubject('reader@example.com'),
    hashRateLimitSubject('reader@example.com'),
  );
  assert.notEqual(
    hashRateLimitSubject('reader@example.com'),
    'reader@example.com',
  );
  assert.equal(isRateLimitAllowed(5, 5), true);
  assert.equal(isRateLimitAllowed(6, 5), false);
}

function testNewsletterConfirmationBoundary() {
  const original = { ...process.env };
  try {
    process.env.NEWSLETTER_CONFIRMATION_DELIVERY_ENABLED = 'true';
    process.env.NEWSLETTER_TEST_RECIPIENTS = 'contact@leonlins.com';
    delete process.env.NEWSLETTER_CONFIRMATION_PRODUCTION_ENABLED;
    assert.equal(canDeliverConfirmation('contact@leonlins.com'), true);
    assert.equal(canDeliverConfirmation('reader@example.com'), false);
    process.env.NEWSLETTER_CONFIRMATION_PRODUCTION_ENABLED = 'true';
    assert.equal(canDeliverConfirmation('reader@example.com'), true);
  } finally {
    process.env = original;
  }
}

function testConfirmationEmailContent() {
  assert.equal(
    CONFIRMATION_SUBJECT,
    'Confirm your subscription to Avoid Boring People',
  );
  const url = 'https://leonlins.com/api/newsletter/confirm?token=abc123';
  const { html, text } = buildConfirmationEmail(url);
  assert.match(html, />Confirm my subscription<\/a>/);
  assert.ok(
    html.includes(`<a href="${url}"`),
    'HTML button links directly to the confirmation URL',
  );
  assert.match(
    text,
    /whatever else I’m exploring\.\nhttps:\/\/leonlins\.com\/api\/newsletter\/confirm\?token=abc123/,
  );
  for (const body of [html, text]) {
    assert.match(body, /Confirm your subscription/);
    assert.match(body, /Thanks for subscribing to Avoid Boring People\./);
    assert.match(body, /If you didn’t subscribe, you can ignore this email\./);
    assert.match(body, /— Leon/);
    assert.match(body, /leonlins\.com/);
  }
  const hrefs = [...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1]);
  assert.ok(hrefs.length > 0);
  for (const href of hrefs)
    assert.ok(
      href.startsWith('https://leonlins.com/'),
      `unexpected confirmation link target: ${href}`,
    );
  assert.doesNotMatch(html, /<img/i);
  assert.doesNotMatch(html, /pixel/i);
  assert.doesNotMatch(html, /track/i);
  assert.doesNotMatch(html, /http:\/\//);
}

function testConfirmPages() {
  const success = buildConfirmSuccessPage();
  assert.match(success, /You’re subscribed\./);
  assert.match(success, /investing, technology, systems/);
  assert.match(success, /publish irregularly/);
  assert.match(success, /newsletter@leonlins\.com to your contacts/);
  assert.ok(
    success.includes('<a class="cta" href="/writing">'),
    'success page links into the archive',
  );
  const invalid = buildConfirmInvalidPage();
  assert.match(invalid, /no longer valid/);
  assert.match(invalid, /work only once/);
  assert.match(invalid, /subscribe again/);
  assert.ok(
    invalid.includes('<a class="cta" href="/#subscribe">'),
    'invalid page links back to signup',
  );
  for (const body of [success, invalid]) {
    assert.match(body, /<!DOCTYPE html>/);
    assert.match(body, /— Leon/);
    assert.match(body, /leonlins\.com/);
    assert.doesNotMatch(body, /token=/);
    assert.doesNotMatch(body, /<script/i);
    assert.doesNotMatch(body, /cadence|weekly|monthly/i);
  }
}

function makeFakeNewsletterDb(
  handler: (query: { text: string; values: unknown[] }) => unknown[],
) {
  const queries: Array<{ text: string; values: unknown[] }> = [];
  const db: any = async (parts: TemplateStringsArray, ...values: unknown[]) => {
    const query = { text: parts.join('\n'), values };
    queries.push(query);
    return handler(query);
  };
  return { db, queries };
}

async function testSubscriptionLifecycleDb() {
  const original = { ...process.env };
  try {
    delete process.env.NEWSLETTER_CONFIRMATION_DELIVERY_ENABLED;
    delete process.env.NEWSLETTER_CONFIRMATION_PRODUCTION_ENABLED;

    // Valid pending confirmation activates exactly once and never stores the raw token.
    const pendingHash = hashToken('good-token');
    let confirmations = 0;
    const confirmDb = makeFakeNewsletterDb((query) => {
      assert.match(query.text, /status = 'pending'/);
      assert.match(query.text, /confirmed_at/);
      assert.match(query.text, /confirmation_token_hash = NULL/);
      if (query.values.includes(pendingHash) && confirmations === 0) {
        confirmations += 1;
        return [{ id: 'subscriber-1' }];
      }
      return [];
    });
    assert.equal(await confirmSubscription('good-token', confirmDb.db), true);
    assert.equal(await confirmSubscription('good-token', confirmDb.db), false);
    assert.equal(await confirmSubscription('wrong-token', confirmDb.db), false);
    assert.equal(await confirmSubscription('', confirmDb.db), false);
    for (const query of confirmDb.queries) {
      assert.ok(
        !query.values.includes('good-token'),
        'raw confirmation token must never reach the database',
      );
    }

    // Suppressed subscribers are never reactivated or rewritten by a new request.
    for (const status of ['active', 'unsubscribed', 'bounced', 'complained']) {
      const suppressedDb = makeFakeNewsletterDb((query) => {
        if (query.text.includes('newsletter_rate_limits'))
          return [{ attempt_count: 1 }];
        if (query.text.includes('SELECT status FROM subscribers'))
          return [{ status }];
        throw new Error(
          `unexpected query for ${status} subscriber: ${query.text}`,
        );
      });
      const response = await requestSubscription(
        { email: 'person@example.com' },
        suppressedDb.db,
      );
      assert.deepEqual(response, {
        ok: true,
        message:
          'If this address can receive this newsletter, check your inbox.',
      });
      assert.ok(
        suppressedDb.queries.every(
          (query) => !query.text.includes('INSERT INTO subscribers'),
        ),
        `${status} must not be rewritten`,
      );
    }

    // A new address creates pending with hashed tokens only.
    const newDb = makeFakeNewsletterDb((query) => {
      if (query.text.includes('newsletter_rate_limits'))
        return [{ attempt_count: 1 }];
      if (query.text.includes('SELECT status FROM subscribers')) return [];
      if (query.text.includes('INSERT INTO subscribers')) {
        assert.match(query.text, /'pending'/);
        return [];
      }
      throw new Error(`unexpected query for new subscriber: ${query.text}`);
    });
    await requestSubscription({ email: 'New@Example.com' }, newDb.db);
    const insert = newDb.queries.find((query) =>
      query.text.includes('INSERT INTO subscribers'),
    );
    assert.ok(insert);
    assert.ok(insert.values.includes('new@example.com'));
    const hashes = insert.values.filter(
      (value) => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value),
    );
    assert.equal(hashes.length, 2);
    assert.notEqual(hashes[0], hashes[1]);
  } finally {
    process.env = original;
  }
}

async function testSnsValidation() {
  for (const path of [
    '/api/newsletter/subscribe',
    '/api/subscribe',
    '/api/newsletter/ses-events/',
  ]) {
    for (const type of [
      'text/plain; charset=UTF-8',
      'multipart/form-data',
      'application/x-www-form-urlencoded',
    ]) {
      const request = new Request(`https://leonlins.com${path}`, {
        method: 'POST',
        headers: { 'content-type': type },
      });
      assert.equal(requiresOriginRejection(request, false), true);
      request.headers.set('origin', 'https://leonlins.com');
      assert.equal(requiresOriginRejection(request, false), false);
    }
  }
  const snsRequest = new Request(
    'https://leonlins.com/api/newsletter/ses-events',
    { method: 'POST', headers: { 'content-type': 'text/plain' } },
  );
  assert.equal(requiresOriginRejection(snsRequest, false), false);
  const oneClickRequest = new Request(
    'https://leonlins.com/api/newsletter/unsubscribe?token=secret',
    {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'List-Unsubscribe=One-Click',
    },
  );
  assert.equal(requiresOriginRejection(oneClickRequest, false), false);
  assert.equal(
    requiresOriginRejection(
      new Request(oneClickRequest.url, {
        method: 'PUT',
        headers: oneClickRequest.headers,
      }),
      false,
    ),
    true,
  );
  assert.equal(
    requiresOriginRejection(
      new Request(snsRequest.url, { method: 'PUT' }),
      false,
    ),
    true,
  );
  assert.equal(
    requiresOriginRejection(
      new Request('https://leonlins.com/api/newsletter/subscribe', {
        method: 'POST',
      }),
      false,
    ),
    true,
  );
  // The Instagram media upload is a CI-only machine caller with no cookies, so a
  // POST is exempt from the origin check; other methods and other paths are not.
  const instagramMedia = 'https://leonlins.com/api/social/instagram-media';
  assert.equal(
    requiresOriginRejection(
      new Request(instagramMedia, { method: 'POST' }),
      false,
    ),
    false,
  );
  assert.equal(
    requiresOriginRejection(
      new Request(instagramMedia, {
        method: 'POST',
        headers: { 'content-type': 'image/jpeg' },
      }),
      false,
    ),
    false,
  );
  assert.equal(
    requiresOriginRejection(
      new Request(instagramMedia, {
        method: 'PUT',
        headers: { 'content-type': 'text/plain' },
      }),
      false,
    ),
    true,
  );
  assert.equal(
    requiresOriginRejection(
      new Request('https://leonlins.com/api/social/instagram-media-preview', {
        method: 'POST',
      }),
      false,
    ),
    true,
  );
  const topic = 'arn:aws:sns:us-east-2:123456789012:newsletter-events';
  const envelope = parseSnsEnvelope({
    Type: 'Notification',
    MessageId: 'event-1',
    TopicArn: topic,
    Message: '{"eventType":"Delivery"}',
    Timestamp: '2026-09-07T00:00:00.000Z',
    SignatureVersion: '2',
    Signature: 'placeholder',
    SigningCertURL:
      'https://sns.us-east-2.amazonaws.com/SimpleNotificationService-test.pem',
  });
  const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const signer = createSign('RSA-SHA256');
  signer.update(signingString(envelope), 'utf8');
  signer.end();
  envelope.Signature = signer.sign(pair.privateKey, 'base64');
  const publicKey = pair.publicKey
    .export({ type: 'pkcs1', format: 'pem' })
    .toString();
  await verifySnsEnvelope(
    envelope,
    topic,
    async () => new Response(publicKey, { status: 200 }),
  );
  await assert.rejects(
    () =>
      verifySnsEnvelope(
        { ...envelope, Message: 'tampered' },
        topic,
        async () => new Response(publicKey),
      ),
    /signature is invalid/,
  );
  const confirmation = {
    ...envelope,
    Type: 'SubscriptionConfirmation' as const,
    Token: 'test-token',
    SubscribeURL: `https://sns.us-east-2.amazonaws.com/?Action=ConfirmSubscription&TopicArn=${encodeURIComponent(topic)}&Token=test-token`,
  };
  const confirmationSigner = createSign('RSA-SHA256');
  confirmationSigner.update(signingString(confirmation));
  confirmation.Signature = confirmationSigner.sign(pair.privateKey, 'base64');
  await verifySnsEnvelope(
    confirmation,
    topic,
    async () => new Response(publicKey),
  );
  await confirmSnsSubscription(confirmation, topic, async (_url, options) => {
    assert.equal(options?.redirect, 'error');
    assert.ok(options?.signal);
    return new Response(null, { status: 200 });
  });
  await assert.rejects(
    () => confirmSnsSubscription({ ...confirmation, Token: 'wrong' }, topic),
    /not for the expected topic/,
  );
  await assert.rejects(
    () =>
      verifySnsEnvelope(
        {
          ...envelope,
          SigningCertURL:
            'https://sns.us-east-2.amazonaws.com:444/SimpleNotificationService-test.pem',
        },
        topic,
      ),
    /not from the expected/,
  );
  const expired = AbortSignal.abort();
  await assert.rejects(
    () =>
      verifySnsEnvelope(
        envelope,
        topic,
        async (_url, options) => {
          options?.signal?.throwIfAborted();
          return new Response(publicKey);
        },
        expired,
      ),
    /abort/i,
  );
  await assert.rejects(
    () =>
      verifySnsEnvelope(
        envelope,
        'arn:aws:sns:us-east-2:123456789012:other',
        async () => new Response(''),
      ),
    /not expected/,
  );
  assert.throws(() => parseSnsEnvelope({ Type: 'Notification' }), /missing/);
}

function testEnrichPost() {
  const heroMeta = {
    src: '/images/hero.webp',
    width: 1200,
    height: 630,
    format: 'webp',
  };

  const baseEntry = makeCollectionEntry({
    data: {
      category: '  Investing  ',
      tags: ['macro', 'rates'],
      heroImage: heroMeta,
    },
  });

  const enriched = enrichPost(baseEntry as any);

  assert.equal(enriched.slug, computeCleanSlug(baseEntry as any));
  assert.equal(enriched.data.category, 'Investing');
  assert.equal(enriched.data.categoryNormalized, 'investing');
  assert.deepEqual(enriched.data.tags, ['macro', 'rates']);
  assert.equal(enriched.data.heroImage, heroMeta);
  assert.ok(enriched.data.readingTime >= 1);

  const relativeEntry = makeCollectionEntry({
    id: '2024_05_02_custom/index.mdx',
    data: {
      category: 'Technology',
      tags: 'not-array',
      heroImage: './cover.webp',
    },
  });

  const relativeHero = enrichPost(relativeEntry as any);

  assert.equal(relativeHero.slug, computeCleanSlug(relativeEntry as any));
  assert.deepEqual(relativeHero.data.tags, []);
  assert.equal(relativeHero.data.heroImage, '/2024_05_02_custom/cover.webp');

  const absoluteEntry = makeCollectionEntry({
    id: '2024_05_03_absolute.md',
    data: {
      heroImage: '/images/custom.png',
    },
  });

  const absoluteHero = enrichPost(absoluteEntry as any);

  assert.equal(absoluteHero.data.heroImage, '/images/custom.png');

  const nestedRelative = makeCollectionEntry({
    id: '2024_05_04_nested/post.mdx',
    data: {
      heroImage: '../shared/banner.png',
    },
  });

  const nestedHero = enrichPost(nestedRelative as any);

  assert.equal(
    nestedHero.data.heroImage,
    '/2024_05_04_nested/shared/banner.png',
  );
}

function testNormalizeHeroImageHelper() {
  const meta = {
    src: '/images/hero.webp',
    width: 100,
    height: 100,
    format: 'webp',
  } as const;

  assert.equal(normalizeHeroImage(meta, '2024_05_01_meta/index.md'), meta);
  assert.equal(
    normalizeHeroImage('./cover.webp', '2024_05_02_custom/index.mdx'),
    '/2024_05_02_custom/cover.webp',
  );
  assert.equal(
    normalizeHeroImage('../shared/cover.webp', 'blog/2024/post.mdx'),
    '/blog/2024/shared/cover.webp',
  );
  assert.equal(
    normalizeHeroImage('/images/direct.png', '2024_05_03_absolute.mdx'),
    '/images/direct.png',
  );
  assert.equal(normalizeHeroImage(null, '2024_05_04.md'), undefined);
}

async function testGetAllPostsPaginated() {
  const posts = [
    makeCollectionEntry({
      id: '2024_06_01_first/index.md',
      data: {
        title: 'First',
        category: 'Investing',
        pubDate: new Date('2024-06-01T00:00:00Z'),
      },
    }),
    makeCollectionEntry({
      id: '2024_06_10_second/index.md',
      data: {
        title: 'Second',
        category: 'Technology',
        pubDate: new Date('2024-06-10T00:00:00Z'),
      },
    }),
    makeCollectionEntry({
      id: '2024_05_01_third/index.md',
      data: {
        title: 'Third',
        category: 'Investing',
        pubDate: new Date('2024-05-01T00:00:00Z'),
      },
    }),
  ];

  setGetCollectionImplementation(async (collection) => {
    assert.equal(collection, 'blog');
    return posts as any;
  });

  try {
    const paginateCalls: any[] = [];
    const paginate = ((items: BlogPost[], options: any) => {
      paginateCalls.push({ items, options });
      const chunks = [] as any[];
      for (let i = 0; i < items.length; i += options.pageSize) {
        chunks.push({
          props: {
            pageNumber: chunks.length + 1,
            items: items.slice(i, i + options.pageSize),
          },
        });
      }
      return chunks;
    }) as any;

    const { pages, categories } = await getAllPostsPaginated(paginate, 2);

    assert.deepEqual(categories, ['investing', 'technology']);
    assert.equal(paginateCalls.length, 1);
    assert.equal(paginateCalls[0].options.pageSize, 2);
    assert.deepEqual(
      pages.map((page) =>
        page.props.items.map((post: BlogPost) => post.data.title),
      ),
      [['Second', 'First'], ['Third']],
    );
  } finally {
    setGetCollectionImplementation(null);
  }
}

async function testGetCategoryPostsPaginated() {
  const posts = [
    makeCollectionEntry({
      id: '2024_01_01_alpha/index.md',
      data: {
        title: 'Alpha',
        category: 'Investing',
        pubDate: new Date('2024-01-01T00:00:00Z'),
      },
    }),
    makeCollectionEntry({
      id: '2024_02_01_beta/index.md',
      data: {
        title: 'Beta',
        category: 'Investing',
        pubDate: new Date('2024-02-01T00:00:00Z'),
      },
    }),
    makeCollectionEntry({
      id: '2024_03_01_gamma/index.md',
      data: {
        title: 'Gamma',
        category: 'Technology',
        pubDate: new Date('2024-03-01T00:00:00Z'),
      },
    }),
  ];

  setGetCollectionImplementation(async () => posts as any);

  try {
    const paginateHistory: any[] = [];
    const paginate = ((items: BlogPost[], options: any) => {
      paginateHistory.push({ items, options });
      return [
        {
          props: {
            pageItems: items,
          },
        },
      ];
    }) as any;

    const routes = await getCategoryPostsPaginated(paginate, 10);

    assert.equal(routes.length, 2);
    assert.deepEqual(
      routes.map((route) => ({
        activeCategory: route.props.activeCategory,
        titles: route.props.pageItems.map((p: BlogPost) => p.data.title),
        categories: route.props.categories,
      })),
      [
        {
          activeCategory: 'investing',
          titles: ['Beta', 'Alpha'],
          categories: ['investing', 'technology'],
        },
        {
          activeCategory: 'technology',
          titles: ['Gamma'],
          categories: ['investing', 'technology'],
        },
      ],
    );

    assert.deepEqual(
      paginateHistory.map((call) => call.options.params.category),
      ['investing', 'technology'],
    );
  } finally {
    setGetCollectionImplementation(null);
  }
}

function testExtractHeadings() {
  const html = `
    <h1 id="title">Main</h1>
    <h2 class="lead" data-info="intro" id='intro'>Intro <em>section</em></h2>
    <h3 data-extra="1" class="sub" id="details">Details <code>code</code></h3>
    <h3 class="loose" id=unquoted>Loose <strong>quotes</strong></h3>
    <h4 id="ignore">Ignore</h4>
    <h2 data-test="x" id="closing">Closing</h2>
  `;

  const headings = extractHeadings(html);
  assert.deepEqual(headings, [
    { level: 2, id: 'intro', text: 'Intro section' },
    { level: 3, id: 'details', text: 'Details code' },
    { level: 3, id: 'unquoted', text: 'Loose quotes' },
    { level: 2, id: 'closing', text: 'Closing' },
  ]);
}

async function withMockGetCollection(
  posts: Array<Record<string, any>>,
  callback: () => Promise<void> | void,
) {
  __setMockGetCollectionImplementation(async () => posts as any);

  try {
    await callback();
  } finally {
    __setMockGetCollectionImplementation(null);
  }
}

async function testContentSchemaEvergreenDefault() {
  const { collections } = await import('../src/content/config.ts');
  const schema = (collections.blog as any).schema({ image: () => z.any() });
  const base = {
    title: 'Evergreen default',
    pubDate: new Date('2020-07-22T00:00:00Z'),
    category: 'Technology',
  };

  assert.equal(
    schema.parse({ ...base }).evergreen,
    true,
    'omitted evergreen must resolve to true so articles opt out instead of opting in',
  );
  assert.equal(schema.parse({ ...base, evergreen: true }).evergreen, true);
  assert.equal(schema.parse({ ...base, evergreen: false }).evergreen, false);
}

async function testSearchIndexEndpoint() {
  const posts = [
    makeCollectionEntry({
      id: '2024_01_01_custom/index.md',
      data: {
        title: 'Custom Title',
        description: 'Custom description',
        slug: '  //custom// ',
        category: 'Finance',
        tags: ['growth', 'markets'],
        pubDate: new Date('2024-01-01T00:00:00Z'),
        evergreen: false,
      },
      body: 'First body text',
    }),
    makeCollectionEntry({
      id: '2024_02_01_second/index.md',
      data: {
        title: 'Second Title',
        description: 'Second description',
        category: 'Markets',
        tags: ['trading'],
        pubDate: new Date('2024-02-01T00:00:00Z'),
        evergreen: true,
      },
      body: 'Second body text',
    }),
  ];

  await withMockGetCollection(posts, async () => {
    const { GET } = await import('../src/pages/search-index.json.ts');
    const response = await GET();

    assert.equal(response.headers.get('Content-Type'), 'application/json');
    const payload = (await response.json()) as Array<Record<string, any>>;

    assert.deepEqual(payload, [
      {
        id: '2024_01_01_custom/index.md',
        title: 'Custom Title',
        url: '/writing/custom/',
        date: '2024-01-01T00:00:00.000Z',
        content: 'First body text',
        category: 'Finance',
        tags: ['growth', 'markets'],
        evergreen: false,
      },
      {
        id: '2024_02_01_second/index.md',
        title: 'Second Title',
        url: '/writing/second/',
        date: '2024-02-01T00:00:00.000Z',
        content: 'Second body text',
        category: 'Markets',
        tags: ['trading'],
        evergreen: true,
      },
    ]);
  });
}

async function testApiSearchIndexEndpoint() {
  const posts = [
    makeCollectionEntry({
      id: '2024_01_01_first/index.md',
      slug: 'first-post',
      data: {
        title: 'First Title',
        description: 'Detailed first post',
        category: 'Finance',
        tags: ['money'],
        pubDate: new Date('2024-01-01T00:00:00Z'),
        heroImage: '/images/first.png',
      },
    }),
    makeCollectionEntry({
      id: '2024_02_01_second/index.md',
      slug: undefined,
      data: {
        title: 'Second Title',
        description: '',
        category: 'Markets',
        tags: ['stocks'],
        pubDate: new Date('2024-02-01T00:00:00Z'),
        heroImage: {
          src: '/images/hero.webp',
          width: 1200,
          height: 630,
        },
      },
    }),
  ];

  await withMockGetCollection(posts, async () => {
    const { GET } = await import('../src/pages/api/search-index.json.ts');
    const response = await GET();

    assert.equal(response.headers.get('Content-Type'), 'application/json');
    const payload = (await response.json()) as Array<Record<string, any>>;

    assert.deepEqual(payload, [
      {
        slug: 'first-post',
        title: 'First Title',
        description: 'Detailed first post',
        category: 'Finance',
        tags: ['money'],
        pubDate: '2024-01-01T00:00:00.000Z',
        heroImage: '/images/first.png',
      },
      {
        slug: '2024_02_01_second/index',
        title: 'Second Title',
        description: '',
        category: 'Markets',
        tags: ['stocks'],
        pubDate: '2024-02-01T00:00:00.000Z',
        heroImage: '/images/hero.webp',
      },
    ]);
  });
}

async function testRssEndpoint() {
  const posts = [
    makeCollectionEntry({
      id: '2024_01_01_alpha/index.md',
      slug: 'alpha',
      data: {
        title: 'Alpha',
        description: 'Alpha description',
        pubDate: new Date('2024-01-01T00:00:00Z'),
      },
    }),
    makeCollectionEntry({
      id: '2024_02_01_beta/index.md',
      slug: 'beta',
      data: {
        title: 'Beta',
        description: 'Beta description',
        pubDate: new Date('2024-02-01T00:00:00Z'),
      },
    }),
  ];

  await withMockGetCollection(posts, async () => {
    const { GET } = await import('../src/pages/rss.xml.ts');
    const response = await GET();
    const xml = await response.text();

    assert.match(xml, /<title>Alpha<\/title>/);
    assert.match(xml, /<link>https:\/\/leonlins.com\/writing\/alpha\/<\/link>/);
    assert.match(xml, /<title>Beta<\/title>/);
    assert.match(xml, /<link>https:\/\/leonlins.com\/writing\/beta\/<\/link>/);
  });
}

async function testInstagramMediaUpload() {
  const {
    BLOB_PATH_HEADER,
    MAX_UPLOAD_BYTES,
    handleInstagramMediaUpload,
    setBlobUploader,
  } = await import('../src/lib/social/instagram-media.ts');
  const { POST, prerender } = await import(
    '../src/pages/api/social/instagram-media.ts'
  );
  const { put } = await import('@vercel/blob');

  const endpoint = 'https://leonlins.com/api/social/instagram-media';
  const secret = 'test-media-upload-secret';
  const pathname = 'instagram/2019_02_18_why/0123456789ab/slide-01.jpg';
  const jpeg = Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    Buffer.alloc(64, 1),
  ]);
  const previousSecret = process.env.INSTAGRAM_MEDIA_UPLOAD_SECRET;

  const calls: {
    pathname: string;
    body: Buffer;
    options: Record<string, unknown>;
  }[] = [];
  const uploader = async (
    path: string,
    body: Buffer,
    options: Record<string, unknown>,
  ) => {
    calls.push({ pathname: path, body, options });
    return {
      url: `https://store1.public.blob.vercel-storage.com/${path}`,
      pathname: path,
    };
  };

  const request = (
    options: {
      method?: string;
      headers?: Record<string, string | undefined>;
      body?: Buffer;
    } = {},
  ) => {
    const headers = new Headers({
      authorization: `Bearer ${secret}`,
      'content-type': 'image/jpeg',
      [BLOB_PATH_HEADER]: pathname,
    });
    for (const [key, value] of Object.entries(options.headers ?? {})) {
      if (value === undefined) headers.delete(key);
      else headers.set(key, value);
    }
    const method = options.method ?? 'POST';
    const init: RequestInit = { method, headers };
    // Node's Buffer is not part of the DOM BodyInit union, but undici accepts it.
    if (method === 'POST')
      init.body = (options.body ?? jpeg) as unknown as BodyInit;
    return new Request(endpoint, init);
  };

  const bodyOf = async (response: Response) =>
    (await response.json()) as Record<string, unknown>;

  // Collect what the endpoint logs so secret hygiene can be asserted, and so a
  // rejected upload does not fill the test output with expected failures.
  const logged: string[] = [];
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    logged.push(args.map((arg) => String(arg)).join(' '));
  };

  try {
    // The route is on-demand only, and it delegates to the shared handler.
    assert.equal(prerender, false);
    assert.equal(typeof POST, 'function');

    process.env.INSTAGRAM_MEDIA_UPLOAD_SECRET = secret;

    const method = await handleInstagramMediaUpload(
      request({ method: 'GET' }),
      uploader,
    );
    assert.equal(method.status, 405);
    assert.equal(method.headers.get('allow'), 'POST');

    for (const [label, overrides] of [
      ['missing', { authorization: undefined }],
      ['wrong', { authorization: 'Bearer not-the-secret' }],
      ['same length', { authorization: `Bearer ${'x'.repeat(secret.length)}` }],
      ['not bearer', { authorization: `Basic ${secret}` }],
      ['bare secret', { authorization: secret }],
    ] as const) {
      const rejected = await handleInstagramMediaUpload(
        request({ headers: { ...overrides } }),
        uploader,
      );
      assert.equal(
        rejected.status,
        401,
        `an ${label} credential must be rejected`,
      );
      assert.equal(rejected.headers.get('www-authenticate'), 'Bearer');
      assert.equal(String((await bodyOf(rejected)).error), 'unauthorized');
    }

    const wrongType = await handleInstagramMediaUpload(
      request({ headers: { 'content-type': 'application/octet-stream' } }),
      uploader,
    );
    assert.equal(wrongType.status, 415);

    const notJpeg = await handleInstagramMediaUpload(
      request({ body: Buffer.from('this is not a jpeg') }),
      uploader,
    );
    assert.equal(notJpeg.status, 415);

    const emptyBody = await handleInstagramMediaUpload(
      request({ body: Buffer.alloc(0) }),
      uploader,
    );
    assert.equal(emptyBody.status, 400);

    for (const [label, badPath] of [
      ['missing', undefined],
      ['traversal', 'instagram/../../../etc/0123456789ab/slide-01.jpg'],
      ['wrong prefix', 'media/2019_02_18_why/0123456789ab/slide-01.jpg'],
      [
        'uppercase digest',
        'instagram/2019_02_18_why/0123456789AB/slide-01.jpg',
      ],
      ['short digest', 'instagram/2019_02_18_why/0123456789a/slide-01.jpg'],
      ['wrong file name', 'instagram/2019_02_18_why/0123456789ab/slide-1.jpg'],
      [
        'extra segment',
        'instagram/2019_02_18_why/0123456789ab/deeper/slide-01.jpg',
      ],
    ] as const) {
      const rejected = await handleInstagramMediaUpload(
        request({ headers: { [BLOB_PATH_HEADER]: badPath } }),
        uploader,
      );
      assert.equal(
        rejected.status,
        400,
        `a ${label} object path must be rejected`,
      );
    }

    const declaredTooLarge = await handleInstagramMediaUpload(
      request({ headers: { 'content-length': String(MAX_UPLOAD_BYTES + 1) } }),
      uploader,
    );
    assert.equal(declaredTooLarge.status, 413);

    const actuallyTooLarge = await handleInstagramMediaUpload(
      request({
        body: Buffer.concat([jpeg, Buffer.alloc(MAX_UPLOAD_BYTES + 1)]),
      }),
      uploader,
    );
    assert.equal(actuallyTooLarge.status, 413);

    assert.equal(
      calls.length,
      0,
      'a rejected request must not reach the Blob store',
    );

    const stored = await handleInstagramMediaUpload(request(), uploader);
    assert.equal(stored.status, 200);
    assert.equal(stored.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await bodyOf(stored), {
      url: `https://store1.public.blob.vercel-storage.com/${pathname}`,
      pathname,
      bytes: jpeg.byteLength,
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].pathname, pathname);
    assert.deepEqual([...calls[0].body], [...jpeg]);
    assert.deepEqual(calls[0].options, {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'image/jpeg',
    });

    for (const [label, result] of [
      ['no URL', {}],
      [
        'insecure URL',
        {
          url: `http://store1.public.blob.vercel-storage.com/${pathname}`,
          pathname,
        },
      ],
      [
        'a different object',
        {
          url: 'https://store1.public.blob.vercel-storage.com/other.jpg',
          pathname: 'instagram/2019_02_18_why/ffffffffffff/slide-01.jpg',
        },
      ],
    ] as const) {
      const failed = await handleInstagramMediaUpload(
        request(),
        async () => result,
      );
      assert.equal(
        failed.status,
        502,
        `a store answering with ${label} must fail closed`,
      );
    }

    const failuresLogged = logged.length;
    const thrown = await handleInstagramMediaUpload(request(), async () => {
      throw new Error(`blob exploded with ${secret}`);
    });
    assert.equal(thrown.status, 502);
    assert.equal(String((await bodyOf(thrown)).error), 'upload failed');
    assert.equal(
      logged.length,
      failuresLogged + 1,
      'a store failure must be logged exactly once',
    );
    assert.match(logged[logged.length - 1], /\[redacted\]/);

    // The route's own wiring reaches the Blob SDK through the seam.
    setBlobUploader(uploader);
    try {
      const viaRoute = await POST({ request: request() } as never);
      assert.equal((viaRoute as Response).status, 200);
      assert.equal(calls.at(-1)?.pathname, pathname);
      const viaRouteUnauthorized = await POST({
        request: request({ headers: { authorization: undefined } }),
      } as never);
      assert.equal((viaRouteUnauthorized as Response).status, 401);
    } finally {
      setBlobUploader(put as never);
    }

    // A missing or blank secret makes the endpoint unusable rather than open.
    const uploadsSoFar = calls.length;
    for (const configured of [undefined, '   ']) {
      if (configured === undefined)
        delete process.env.INSTAGRAM_MEDIA_UPLOAD_SECRET;
      else process.env.INSTAGRAM_MEDIA_UPLOAD_SECRET = configured;
      const unconfigured = await handleInstagramMediaUpload(
        request(),
        uploader,
      );
      assert.equal(unconfigured.status, 503);
      assert.equal(
        calls.length,
        uploadsSoFar,
        'an unconfigured endpoint must not upload',
      );
    }
    assert.ok(
      logged.every((line) => !line.includes(secret)),
      'the upload secret must never reach the logs',
    );
  } finally {
    console.error = originalConsoleError;
    if (previousSecret === undefined)
      delete process.env.INSTAGRAM_MEDIA_UPLOAD_SECRET;
    else process.env.INSTAGRAM_MEDIA_UPLOAD_SECRET = previousSecret;
    setBlobUploader(put as never);
  }
}

function testJsonLdSerialization() {
  const payload = '</script><script>alert(1)</script>';
  const serialized = serializeJsonLd({
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: payload,
    datePublished: new Date('2026-01-01T00:00:00.000Z'),
    nested: { description: `Tail --> ${payload}` },
  });

  assert.ok(
    !serialized.includes('<'),
    'serialized JSON-LD must not contain a raw <',
  );
  assert.ok(
    !/<!--/.test(serialized),
    'serialized JSON-LD must not open an HTML comment',
  );
  assert.ok(
    serialized.includes('\\u003c/script>'),
    'the closing script tag must be escaped into data',
  );

  const parsed = JSON.parse(serialized);
  assert.equal(parsed.headline, payload);
  assert.equal(parsed.nested.description, `Tail --> ${payload}`);
  assert.equal(parsed.datePublished, '2026-01-01T00:00:00.000Z');

  // Embedded in the element the components emit, the payload cannot close it.
  const html = `<script type="application/ld+json">${serialized}</script>`;
  assert.equal(
    html.split('</script>').length,
    2,
    'only the tag the template wrote may close the script element',
  );
  assert.equal(
    JSON.parse(html.slice(html.indexOf('>') + 1, html.lastIndexOf('</script>')))
      .headline,
    payload,
  );

  assert.equal(serializeJsonLd(undefined), 'null');
  assert.equal(serializeJsonLd({ ratio: Number.NaN, ok: true }), '{"ok":true}');
}

function testOriginTrust() {
  const form = { 'content-type': 'application/x-www-form-urlencoded' };
  const post = (url: string, headers: Record<string, string>) =>
    new Request(url, { method: 'POST', headers: { ...form, ...headers } });

  // The configured canonical origin is trusted, whatever URL the request arrived on.
  assert.equal(
    requiresOriginRejection(
      post('https://leonlins.com/api/subscribe', {
        origin: 'https://leonlins.com',
      }),
      false,
    ),
    false,
  );
  assert.equal(
    requiresOriginRejection(
      post('https://internal-deployment.vercel.app/api/subscribe', {
        origin: 'https://leonlins.com',
      }),
      false,
    ),
    false,
  );

  // Foreign or absent origins are still rejected.
  assert.equal(
    requiresOriginRejection(
      post('https://leonlins.com/api/subscribe', {
        origin: 'https://evil.example',
      }),
      false,
    ),
    true,
  );
  assert.equal(
    requiresOriginRejection(
      post('https://leonlins.com/api/subscribe', {}),
      false,
    ),
    true,
  );

  // A caller that controls the forwarded headers makes the request URL look like
  // its own origin; the trusted origin must not move with it.
  assert.equal(
    requiresOriginRejection(
      post('https://evil.example/api/subscribe', {
        origin: 'https://evil.example',
        'x-forwarded-host': 'evil.example',
        'x-forwarded-proto': 'https',
      }),
      false,
    ),
    true,
  );
  assert.equal(
    requiresOriginRejection(
      post('https://leonlins.com/api/subscribe', {
        origin: 'https://evil.example',
        'x-forwarded-host': 'leonlins.com',
        'x-forwarded-proto': 'https',
      }),
      false,
    ),
    true,
  );
  assert.equal(
    requiresOriginRejection(
      post('https://leonlins.com/api/subscribe', {
        origin: 'https://leonlins.com',
        'x-forwarded-host': 'evil.example',
        'x-forwarded-proto': 'http',
      }),
      false,
    ),
    false,
  );

  // Machine callers keep their exemptions.
  assert.equal(
    requiresOriginRejection(
      new Request('https://evil.example/api/newsletter/ses-events', {
        method: 'POST',
        headers: {
          'content-type': 'text/plain',
          origin: 'https://evil.example',
        },
      }),
      false,
    ),
    false,
  );

  // The trusted origin is the canonical site origin from `src/consts.ts`, so a
  // deployment URL, a `Host` header, or a forwarded header cannot move it.
  assert.equal(canonicalSiteOrigin(), 'https://leonlins.com');
  assert.equal(canonicalSiteOrigin(), new URL(SITE_URL).origin);
  process.env.SITE_URL = 'https://preview.example/';
  try {
    assert.equal(canonicalSiteOrigin(), 'https://leonlins.com');
    assert.equal(
      requiresOriginRejection(
        post('https://preview.example/api/subscribe', {
          origin: 'https://preview.example',
        }),
        false,
      ),
      true,
    );
    assert.equal(
      requiresOriginRejection(
        post('https://leonlins.com/api/subscribe', {
          origin: 'https://preview.example',
        }),
        false,
      ),
      true,
    );
  } finally {
    delete process.env.SITE_URL;
  }
}

function testPathOverrideGuard() {
  assert.equal(
    hasUntrustedPathOverride(
      new Request('https://leonlins.com/_image?href=/a.png&f=png'),
    ),
    false,
  );
  assert.equal(
    hasUntrustedPathOverride(
      new Request('https://leonlins.com/api/newsletter/unsubscribe?token=x'),
    ),
    false,
  );
  assert.equal(
    hasUntrustedPathOverride(
      new Request(
        'https://leonlins.com/_image?x_astro_path=/api/newsletter/unsubscribe',
      ),
    ),
    true,
  );
  assert.equal(
    hasUntrustedPathOverride(
      new Request('https://leonlins.com/anything', {
        headers: { 'x-astro-path': '/api/social/instagram-media' },
      }),
    ),
    true,
  );
  assert.equal(
    hasUntrustedPathOverride(
      new Request('https://leonlins.com/anything', {
        headers: { 'x-astro-path': '' },
      }),
    ),
    true,
  );
}

const REPO_ROOT = path.resolve(BLOG_CONTENT_DIR, '../../..');
const ROBOTS_PATH = path.join(REPO_ROOT, 'public/robots.txt');

function testArticleSitemapLastmod() {
  const lastmod = buildBlogLastmodMap();
  const routes = readArticleRoutes();

  assert.ok(
    routes.length > 50,
    `expected the whole blog corpus, read ${routes.length} articles`,
  );
  assert.ok(
    Object.keys(lastmod).length > 50,
    `expected the whole blog corpus, mapped ${Object.keys(lastmod).length} dates`,
  );

  // The bug this guards: map keys were built as `/writing/<slug>/` while the
  // sitemap looked up `/writing/<slug>`, so every article silently fell back to
  // STATIC_LASTMOD. Keys must be normalized, and every article must be found.
  for (const key of Object.keys(lastmod)) {
    assert.equal(key, normalizePathname(key), `un-normalized key: ${key}`);
    assert.equal(key.includes('//'), false, `malformed key: ${key}`);
  }
  for (const route of routes) {
    assert.notEqual(
      resolveLastmod(route.pathname, lastmod),
      STATIC_LASTMOD,
      `${route.pathname} must not fall back to the static lastmod`,
    );
    assert.equal(
      resolveLastmod(route.pathname, lastmod),
      route.lastmod,
      `${route.pathname} must use the article's own date`,
    );
    // A trailing slash must resolve to the same date, not to the fallback.
    assert.equal(resolveLastmod(`${route.pathname}/`, lastmod), route.lastmod);
  }

  assert.equal(
    resolveLastmod('/writing/ergodicity', lastmod),
    '2021-04-03T00:00:00.000Z',
  );
  assert.equal(
    resolveLastmod('/writing/ergodicity/', lastmod),
    '2021-04-03T00:00:00.000Z',
  );

  // Non-article pages keep the stable static fallback.
  for (const staticPath of ['/', '/about/', '/about', '/writing/search/']) {
    assert.equal(resolveLastmod(staticPath, lastmod), STATIC_LASTMOD);
  }
}

function testSitemapSerializationUsesArticleDates() {
  const lastmod = buildBlogLastmodMap();

  const article = serializeSitemapItem(
    { url: 'https://leonlins.com/writing/ergodicity/' },
    lastmod,
  );
  assert.equal(article.url, 'https://leonlins.com/writing/ergodicity');
  assert.equal(article.lastmod, '2021-04-03T00:00:00.000Z');

  const slashless = serializeSitemapItem(
    { url: 'https://leonlins.com/writing/ergodicity' },
    lastmod,
  );
  assert.equal(slashless.lastmod, '2021-04-03T00:00:00.000Z');

  const staticPage = serializeSitemapItem(
    { url: 'https://leonlins.com/about/' },
    lastmod,
  );
  assert.equal(staticPage.url, 'https://leonlins.com/about');
  assert.equal(staticPage.lastmod, STATIC_LASTMOD);

  const root = serializeSitemapItem({ url: 'https://leonlins.com/' }, lastmod);
  assert.equal(root.url, 'https://leonlins.com/');
  assert.equal(root.lastmod, STATIC_LASTMOD);

  // Unrelated item fields survive serialization.
  const extended = serializeSitemapItem(
    { url: 'https://leonlins.com/writing/kelly/', changefreq: 'weekly' },
    lastmod,
  );
  assert.equal(extended.changefreq, 'weekly');
}

function testArticleLastmodPrefersUpdatedDate() {
  const blogDir = fs.mkdtempSync(path.join(os.tmpdir(), 'article-routes-'));

  const writeArticle = (entry: string, frontmatter: string) => {
    fs.mkdirSync(path.join(blogDir, entry));
    fs.writeFileSync(
      path.join(blogDir, entry, 'index.md'),
      `---\n${frontmatter}\n---\nBody text.\n`,
      'utf-8',
    );
  };

  try {
    writeArticle(
      '2024_01_05_both_dates',
      "title: 'Both'\npubDate: 2024-01-05\nupdatedDate: 2024-06-01",
    );
    writeArticle(
      '2024_02_06_slug_override',
      "title: 'Slug'\npubDate: 2024-02-06\nslug: 'custom-slug'",
    );
    writeArticle('2023_03_07_no_date', "title: 'No date'");

    assert.deepEqual(buildBlogLastmodMap(blogDir), {
      '/writing/both_dates': '2024-06-01T00:00:00.000Z',
      '/writing/custom-slug': '2024-02-06T00:00:00.000Z',
    });
  } finally {
    fs.rmSync(blogDir, { recursive: true, force: true });
  }
}

function testLegacyArticleRedirects() {
  const redirects = buildLegacyArticleRedirects();
  const lastmod = buildBlogLastmodMap();

  const assertRedirect = (legacyPath: string, canonicalPath: string) => {
    assert.deepEqual(
      redirects[legacyPath],
      { destination: canonicalPath, status: 308 },
      `${legacyPath} must permanently redirect to ${canonicalPath}`,
    );
  };

  assertRedirect('/writing/2020_12_02_kelly', '/writing/kelly');
  assertRedirect('/writing/2021_04_03_ergodicity', '/writing/ergodicity');
  assertRedirect('/writing/2019_03_24_time', '/writing/time_illusion');
  assertRedirect('/writing/2020_11_04_ib', '/writing/ib_value');
  assertRedirect('/writing/2020_11_11_capital', '/writing/company_value');

  const legacyRouteCount = readArticleRoutes().filter(
    (route) => route.legacyPathname,
  ).length;
  assert.equal(
    Object.keys(redirects).length,
    legacyRouteCount + Object.keys(LEGACY_ARTICLE_ALIASES).length,
    'every legacy path should be listed exactly once',
  );

  for (const key of Object.keys(redirects)) {
    const redirect = redirects[key];
    assert.equal(redirect.status, 308);
    assert.equal(
      key,
      normalizePathname(key),
      'a trailing slash in a redirect key is dropped by Astro and collides with the slashless key',
    );
    assert.notEqual(normalizePathname(key), redirect.destination);
    // Destinations must be real article routes, not another redirect stub.
    assert.ok(
      lastmod[redirect.destination],
      `${redirect.destination} must resolve to a built article`,
    );
  }
}

/**
 * The legacy redirect keys can only match slashless requests, so the deployed
 * router has to normalize the trailing-slash form onto them for the old
 * inbound URLs (which were almost always linked with a trailing slash) to work.
 */
async function testLegacyRedirectsReachTrailingSlashRequests() {
  const { default: config } = await import('../astro.config.mjs');

  assert.equal(
    (config as { trailingSlash?: string }).trailingSlash,
    'never',
    'trailing slash normalization is what makes /writing/2020_12_02_kelly/ reach the redirect',
  );

  const redirects = (config as { redirects: Record<string, unknown> })
    .redirects;
  assert.deepEqual(redirects['/writing/2020_12_02_kelly'], {
    destination: '/writing/kelly',
    status: 308,
  });
  assert.equal(
    redirects['/writing/2020_12_02_kelly/'],
    undefined,
    'slash variants must not be added: Astro reports them as route collisions',
  );
}

function testContentHasNoLegacyArticleLinks() {
  const legacyPattern =
    /(?:leonlins\.com)?\/writing\/\d{4}_\d{2}_\d{2}_[A-Za-z0-9_.-]+/;
  const knownSlugs = new Set(readArticleRoutes().map((route) => route.slug));
  const ignoredSegments = new Set(['category']);
  const brokenLinks: string[] = [];
  const legacyLinks: string[] = [];

  for (const entry of fs.readdirSync(BLOG_CONTENT_DIR)) {
    const articlePath = path.join(BLOG_CONTENT_DIR, entry, 'index.md');
    if (!fs.existsSync(articlePath)) continue;
    const content = fs.readFileSync(articlePath, 'utf-8');

    if (legacyPattern.test(content)) {
      legacyLinks.push(entry);
    }

    for (const match of content.matchAll(/\]\((\/writing\/[^)\s'"]*)/g)) {
      const slug = normalizePathname(match[1]).replace('/writing/', '');
      const [segment] = slug.split('/');
      if (ignoredSegments.has(segment) || /^\d+$/.test(segment)) continue;
      if (!knownSlugs.has(slug)) {
        brokenLinks.push(`${entry}: ${match[1]}`);
      }
    }
  }

  assert.deepEqual(
    legacyLinks,
    [],
    'date-prefixed article links must be repaired to canonical URLs',
  );
  assert.deepEqual(
    brokenLinks,
    [],
    'internal article links must point at routes that are actually built',
  );
}

function testAuthorIdentityGraph() {
  const threads = 'https://www.threads.net/@leon.lin.s';

  assert.equal(
    SITE_AUTHOR_SAME_AS.filter((url) => url === threads).length,
    1,
    'Threads must appear exactly once in the Person sameAs graph',
  );
  assert.equal(
    SITE_AUTHOR_SAME_AS.length,
    new Set(SITE_AUTHOR_SAME_AS).size,
    'sameAs entries must be unique',
  );
  assert.deepEqual(SITE_AUTHOR_SAME_AS, [
    'https://twitter.com/leonlinsx',
    'https://github.com/leonlinsx',
    'https://avoidboringpeople.substack.com',
    threads,
  ]);
  assert.equal(
    SITE_AUTHOR_SAME_AS.some((url) => url.toLowerCase().includes('linkedin')),
    false,
    'LinkedIn is intentionally not part of the identity graph',
  );
}

/** One rule group per user agent; consecutive user-agent lines share a group. */
function parseRobotsGroups(text: string): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  let agents: string[] = [];
  let lastLineWasUserAgent = false;

  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/#.*$/, '').trim();
    const separator = line.indexOf(':');
    if (separator === -1) continue;

    const directive = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (!value) continue;

    if (directive === 'user-agent') {
      if (!lastLineWasUserAgent) agents = [];
      lastLineWasUserAgent = true;
      agents.push(value);
      for (const agent of agents) {
        if (!groups.has(agent)) groups.set(agent, []);
      }
      continue;
    }

    if (directive === 'sitemap') continue;
    lastLineWasUserAgent = false;
    for (const agent of agents) {
      groups.get(agent)?.push(`${directive} ${value}`);
    }
  }

  return groups;
}

function testRobotsCrawlerPolicy() {
  const groups = parseRobotsGroups(fs.readFileSync(ROBOTS_PATH, 'utf-8'));
  const allowedAgents = [
    'OAI-SearchBot',
    'PerplexityBot',
    'Claude-SearchBot',
    'Claude-User',
  ];
  const blockedAgents = ['GPTBot', 'Google-Extended', 'ClaudeBot'];

  for (const agent of allowedAgents) {
    const rules = groups.get(agent);
    assert.ok(rules, `${agent} must have a rule group`);
    assert.ok(
      rules.includes('allow /'),
      `${agent} performs search/retrieval and must be allowed`,
    );
    assert.equal(
      rules.includes('disallow /'),
      false,
      `${agent} must not be blocked`,
    );
  }

  for (const agent of blockedAgents) {
    const rules = groups.get(agent);
    assert.ok(rules, `${agent} must have a rule group`);
    assert.ok(
      rules.includes('disallow /'),
      `${agent} trains models and must be blocked site-wide`,
    );
    assert.equal(
      rules.includes('allow /'),
      false,
      `${agent} must not be allowed back in`,
    );
  }

  const wildcard = groups.get('*');
  assert.ok(wildcard, 'a default rule group is needed');
  assert.ok(wildcard.includes('allow /'), 'ordinary crawlers stay allowed');
  for (const privatePath of ['/api/', '/admin/', '/private/']) {
    assert.ok(
      wildcard.includes(`disallow ${privatePath}`),
      `${privatePath} must stay excluded`,
    );
  }

  for (const searchEngine of ['Googlebot', 'Bingbot']) {
    assert.ok(groups.get(searchEngine)?.includes('allow /'));
  }

  const robots = fs.readFileSync(ROBOTS_PATH, 'utf-8');
  assert.match(
    robots,
    /^Sitemap: https:\/\/leonlins\.com\/sitemap-index\.xml$/m,
  );
}

/**
 * The 404 handler used to inherit an auto-derived canonical URL, so 404.html
 * advertised `https://leonlins.com/404` (og:url and twitter:url too) on a page
 * that is served for arbitrary unknown paths: the advertised URL itself 404s.
 */
function testNotFoundPageHasNoCanonical() {
  const page = fs.readFileSync(
    path.join(REPO_ROOT, 'src/pages/404.astro'),
    'utf-8',
  );
  assert.match(page, /noindex=\{true\}/, 'the 404 page must not be indexed');
  assert.match(
    page,
    /canonical=\{null\}/,
    'the 404 page has no canonical URL to advertise',
  );

  const head = fs.readFileSync(
    path.join(REPO_ROOT, 'src/components/BaseHead.astro'),
    'utf-8',
  );
  for (const tag of [
    '<link rel="canonical"',
    '<meta property="og:url"',
    '<meta name="twitter:url"',
  ]) {
    const line = head.split('\n').find((candidate) => candidate.includes(tag));
    assert.ok(line, `${tag} should still be emitted for normal pages`);
    assert.match(
      line,
      /canonicalURL &&/,
      `${tag} must be omitted when a page has no canonical URL`,
    );
  }
}

const COMMENT_SLUG = 'sample-article';
const COMMENT_ID_PRIMARY = '11111111-1111-4111-8111-111111111111';
const COMMENT_ID_REPLY = '22222222-2222-4222-8222-222222222222';

function makeCommentRow(overrides: Partial<CommentRow> = {}): CommentRow {
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

function makeFakeCommentDb(
  handler: (query: { text: string; values: unknown[] }) => unknown[],
) {
  const queries: Array<{ text: string; values: unknown[] }> = [];
  const db: any = async (parts: TemplateStringsArray, ...values: unknown[]) => {
    const query = { text: parts.join(' {?} '), values };
    queries.push(query);
    return handler(query);
  };
  return { db, queries };
}

/** A fake database that fails the test if the handler reaches the database. */
function makeForbiddenCommentDb() {
  return makeFakeCommentDb(() => {
    throw new Error('the handler must not query the database for this request');
  });
}

/** The single recorded query whose SQL matches `pattern`. */
function commentQuery(
  queries: Array<{ text: string; values: unknown[] }>,
  pattern: RegExp,
): { text: string; values: unknown[] } {
  const matches = queries.filter((query) => pattern.test(query.text));
  assert.equal(
    matches.length,
    1,
    `expected exactly one query matching ${pattern}`,
  );
  const [match] = matches;
  assert.ok(match);
  return match;
}

const verifiedTurnstileFetch = (async () =>
  new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })) as unknown as typeof fetch;

function testCommentDomain() {
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

function testCommentTokens() {
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

function testCommentDisplay() {
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

async function testCommentTurnstile() {
  // The site key normalizer gates the form; a blank value disables it entirely.
  assert.equal(
    turnstileSiteKey('  1x00000000000000000000AA  '),
    '1x00000000000000000000AA',
  );
  assert.equal(turnstileSiteKey(''), null);
  assert.equal(turnstileSiteKey('   '), null);
  assert.equal(turnstileSiteKey(undefined), null);

  // A missing site key silently disables the form on every article, so the build
  // log has to say so once rather than once per page.
  const warnings: unknown[][] = [];
  const originalConsoleWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    warnings.push(args);
  };
  try {
    warnIfSiteKeyMissing(null);
    warnIfSiteKeyMissing(null);
    warnIfSiteKeyMissing('1x00000000000000000000AA');
  } finally {
    console.warn = originalConsoleWarn;
  }
  assert.equal(warnings.length, 1);
  assert.match(String(warnings[0][0]), /PUBLIC_TURNSTILE_SITE_KEY/);

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

async function testCommentHandlers() {
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
  const list = makeFakeCommentDb((query) => {
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
  const anonymous = makeFakeCommentDb((query) => {
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

  const badSlug = makeForbiddenCommentDb();
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
    const failing = makeFakeCommentDb(() => {
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

  const crossSite = makeForbiddenCommentDb();
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

  const oversized = makeForbiddenCommentDb();
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
    const malformed = makeForbiddenCommentDb();
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
  const unverified = makeForbiddenCommentDb();
  const unconfiguredResponse = await post(
    commentPayload,
    handlerDeps({
      db: unverified.db,
      turnstileSecret: '',
      fetchImpl: unreachableTurnstile,
    }),
  );
  assert.equal(unconfiguredResponse.status, 503);

  const rejected = makeForbiddenCommentDb();
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

  const outage = makeForbiddenCommentDb();
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
        db: makeForbiddenCommentDb().db,
        turnstileSecret: '',
        fetchImpl: unreachableTurnstile,
      }),
    );
    await post(
      commentPayload,
      handlerDeps({
        db: makeForbiddenCommentDb().db,
        fetchImpl: unreachableTurnstile,
      }),
    );
    await post(
      commentPayload,
      handlerDeps({
        db: makeForbiddenCommentDb().db,
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
  const honeypotDb = makeFakeCommentDb((query) => {
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
    const invalid = makeForbiddenCommentDb();
    const response = await post(payload, handlerDeps({ db: invalid.db }));
    assert.equal(response.status, 400, `${error} must be a 400`);
    assert.equal((await jsonOf(response)).error, error);
  }

  // Rate limiting is counted from the comments table, before the insert.
  const rateLimitedDb = makeFakeCommentDb((query) => {
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
  const underLimitDb = makeFakeCommentDb((query) =>
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
  const missingParentDb = makeFakeCommentDb((query) =>
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

  const successDb = makeFakeCommentDb((query) =>
    /count\(\*\)/.test(query.text) ? [{ recent: 0 }] : [makeCommentRow()],
  );
  const created = await post(commentPayload, handlerDeps({ db: successDb.db }));
  assert.equal(created.status, 201);
  const createdBody = await jsonOf(created);
  const createdComment = createdBody.comment as Record<string, unknown>;
  assert.equal(createdComment.isAuthor, false);
  assert.equal(createdComment.canEdit, true);
  assert.equal(createdComment.body, 'A thoughtful comment');

  const inserted = commentQuery(successDb.queries, /INSERT INTO comments/);
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
  const existingDb = makeFakeCommentDb((query) =>
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
      commentQuery(existingDb.queries, /INSERT INTO comments/).values,
    ),
    tokenHash,
  );

  // A malformed cookie is treated as no identity at all.
  const malformedDb = makeFakeCommentDb((query) =>
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
      commentQuery(malformedDb.queries, /INSERT INTO comments/).values,
    ),
    hashCommentToken('not-a-token'),
  );

  // A public visitor naming themselves "Leon" gets no author badge.
  const impostorDb = makeFakeCommentDb((query) => {
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
  const crossSitePatch = makeForbiddenCommentDb();
  const crossSitePatchResponse = await patch(
    { body: 'edited' },
    handlerDeps({ db: crossSitePatch.db }),
    { headers: { origin: 'https://evil.example' } },
  );
  assert.equal(crossSitePatchResponse.status, 403);
  assert.equal((await jsonOf(crossSitePatchResponse)).error, 'cross_site');

  const unknownId = makeForbiddenCommentDb();
  const unknownIdResponse = await patch(
    { body: 'edited' },
    handlerDeps({ db: unknownId.db }),
    { id: 'not-a-uuid' },
  );
  assert.equal(unknownIdResponse.status, 404);
  assert.equal((await jsonOf(unknownIdResponse)).error, 'not_found');

  const noCookie = makeForbiddenCommentDb();
  const noCookieResponse = await patch(
    { body: 'edited' },
    handlerDeps({ db: noCookie.db }),
  );
  assert.equal(noCookieResponse.status, 403);
  assert.equal((await jsonOf(noCookieResponse)).error, 'not_owned');

  const emptyEdit = makeForbiddenCommentDb();
  const emptyEditResponse = await patch(
    { body: '   ' },
    handlerDeps({ db: emptyEdit.db }),
    { headers: { cookie: commentTokenCookie(token) } },
  );
  assert.equal(emptyEditResponse.status, 400);
  assert.equal((await jsonOf(emptyEditResponse)).error, 'body_required');

  // Outside the window (or from another browser) the update simply matches nothing.
  const expiredDb = makeFakeCommentDb(() => []);
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
  const updateDb = makeFakeCommentDb((query) => {
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
  const crossSiteDelete = makeForbiddenCommentDb();
  const crossSiteDeleteResponse = await remove(
    handlerDeps({ db: crossSiteDelete.db }),
    { headers: { origin: 'https://evil.example' } },
  );
  assert.equal(crossSiteDeleteResponse.status, 403);

  const deleteWithoutCookie = await remove(
    handlerDeps({ db: makeForbiddenCommentDb().db }),
  );
  assert.equal(deleteWithoutCookie.status, 403);
  assert.equal((await jsonOf(deleteWithoutCookie)).error, 'not_owned');

  const deleteDb = makeFakeCommentDb((query) =>
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
  const placeholderDb = makeFakeCommentDb((query) => {
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

  const unavailableDb = makeFakeCommentDb(() => []);
  const unavailable = await remove(handlerDeps({ db: unavailableDb.db }), {
    headers: { cookie: commentTokenCookie(token) },
  });
  assert.equal(unavailable.status, 403);
  assert.equal((await jsonOf(unavailable)).error, 'not_owned');
}

/** The token hash the handler passed to an insert or update. */
function tokenHashOfInsert(values: unknown[]): unknown {
  const hash = values.find(
    (value) => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value),
  );
  assert.ok(hash, 'the insert must be keyed by a token hash');
  return hash;
}

async function testCommentStoreSql() {
  // Reading a discussion: published rows only, replies only under a published
  // parent, and ownership decided in SQL and exposed as a boolean.
  const list = makeFakeCommentDb(() => []);
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
  const count = makeFakeCommentDb(() => [{ recent: 2 }]);
  assert.equal(await countRecentComments(count.db, 'hash'), 2);
  assert.match(count.queries[0].text, /author_token_hash =/);
  assert.ok(count.queries[0].values.includes(RATE_LIMIT_WINDOW_INTERVAL));
  assert.ok(!/post_slug/.test(count.queries[0].text));

  // A top-level comment and a reply are the same guarded insert, so a reply can
  // never point at another article, at a reply, or at a hidden comment.
  const insert = makeFakeCommentDb(() => [makeCommentRow()]);
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

  const rejected = makeFakeCommentDb(() => []);
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
  const update = makeFakeCommentDb(() => [makeCommentRow({ can_edit: true })]);
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
  const hardDelete = makeFakeCommentDb(() => [{ id: COMMENT_ID_PRIMARY }]);
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
  const placeholder = makeFakeCommentDb((query) =>
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

  const nothing = makeFakeCommentDb(() => []);
  assert.equal(
    await deleteOwnComment(nothing.db, {
      id: COMMENT_ID_PRIMARY,
      slug: COMMENT_SLUG,
      tokenHash: 'hash',
    }),
    'unavailable',
  );

  // Operator reads and status changes.
  const operator = makeFakeCommentDb(() => []);
  await listCommentsForOperator(operator.db, {
    slug: null,
    includeHidden: false,
  });
  assert.match(operator.queries[0].text, /status = 'published'/);
  assert.deepEqual(operator.queries[0].values, [null, null, false]);

  const hide = makeFakeCommentDb(() => [{ id: COMMENT_ID_PRIMARY }]);
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
      makeFakeCommentDb(() => []).db,
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
  const cascade = makeFakeCommentDb(() => cascadeRows);
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
    await deleteCommentWithReplies(
      makeFakeCommentDb(() => []).db,
      COMMENT_ID_PRIMARY,
    ),
    null,
  );

  // Author replies are the only way is_author is ever set.
  const reply = makeFakeCommentDb(() => [
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

function testCommentIntegrationBoundaries() {
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
    assert.match(route, /import \{ tryCommentsDb \} from '.*comments\/db\.ts'/);
    assert.ok(
      !route.includes('function tryCommentsDb'),
      'the null-database adapter must live in src/lib/comments/db.ts',
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
  assert.match(island, /website: honeypot/);
  assert.match(island, /No comments yet\. Add the first one\./);
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

async function run() {
  try {
    testSearchPosts();
    testComputeCleanSlug();
    testNormalizeQuery();
    testBuildPaginationHref();
    testTitleCase();
    testNormalizeCategory();
    testNewsletterDomain();
    testNewsletterImporter();
    testNewsletterRenderer();
    testNewsletterTestSendSafeguard();
    testNewsletterProductionSendSafeguards();
    testNewsletterSafetyHelpers();
    testNewsletterConfirmationBoundary();
    testConfirmationEmailContent();
    testConfirmPages();
    await testSubscriptionLifecycleDb();
    await testSnsValidation();
    testJsonLdSerialization();
    testOriginTrust();
    testPathOverrideGuard();
    testArticleSitemapLastmod();
    testSitemapSerializationUsesArticleDates();
    testArticleLastmodPrefersUpdatedDate();
    testLegacyArticleRedirects();
    await testLegacyRedirectsReachTrailingSlashRequests();
    testContentHasNoLegacyArticleLinks();
    testAuthorIdentityGraph();
    testRobotsCrawlerPolicy();
    testNotFoundPageHasNoCanonical();
    testEnrichPost();
    await testGetAllPostsPaginated();
    await testGetCategoryPostsPaginated();
    testNormalizeHeroImageHelper();
    testExtractHeadings();
    await testContentSchemaEvergreenDefault();
    await testSearchIndexEndpoint();
    await testApiSearchIndexEndpoint();
    await testRssEndpoint();
    await testInstagramMediaUpload();
    testCommentDomain();
    testCommentTokens();
    testCommentDisplay();
    await testCommentTurnstile();
    await testCommentHandlers();
    await testCommentStoreSql();
    testCommentIntegrationBoundaries();
    console.log('✅ All custom tests passed');
  } catch (error) {
    console.error('❌ Test failure', error);
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error('❌ Unhandled failure', error);
  process.exitCode = 1;
});
