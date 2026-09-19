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
  newsletterAlert,
  type NewsletterAlertFields,
} from '../src/lib/newsletter/alerting.ts';
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
  buildConfirmPromptPage,
  buildConfirmSuccessPage,
} from '../src/lib/newsletter/confirm-pages.ts';
import {
  buildConfirmationEmail,
  canDeliverConfirmation,
  CONFIRMATION_SUBJECT,
  confirmSubscription,
  genericSubscriptionResponse,
  requestSubscription,
  unsubscribe,
} from '../src/lib/newsletter/subscriptions.ts';
import { recordSesEvent } from '../src/lib/newsletter/events.ts';
import {
  confirmSnsSubscription,
  parseSnsEnvelope,
  signingString,
  verifySnsEnvelope,
} from '../src/lib/newsletter/sns.ts';
import {
  ATTRIBUTION_STORAGE_KEY,
  attributionFromRequest,
  attributionPayload,
  firstTouchAttribution,
  isInformativeSource,
  normalizeAttribution,
  readStoredAttribution,
  referrerDomain,
} from '../src/lib/newsletter/attribution.ts';
import {
  collectNewsletterMetrics,
  MAX_REPORT_WINDOW_DAYS,
  MIN_SHARE_SAMPLE,
  newsletterCheckExitCode,
  renderNewsletterReport,
  reportAnalyticsCollectionFailure,
  validateReportWindow,
} from '../src/lib/newsletter/analytics.ts';
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
} from '../src/lib/turnstile.ts';
import {
  CONTACT_EMAIL,
  CONTACT_SUCCESS_MESSAGE,
  MAX_CONTACT_EMAIL_LENGTH,
  MAX_CONTACT_MESSAGE_LENGTH,
  MAX_CONTACT_NAME_LENGTH,
  MAX_CONTACT_SOURCE_LENGTH,
  UNKNOWN_SOURCE_PAGE,
  contactErrors,
  normalizeContactEmail,
  normalizeContactMessage,
  normalizeContactName,
  normalizeSourcePage,
  validateContactNote,
} from '../src/lib/contact/domain.ts';
import { contactAlertKinds } from '../src/lib/contact/alerting.ts';
import {
  createContactSubmission,
  markContactLinCheckSynced,
  markContactNotified,
} from '../src/lib/contact/store.ts';
import {
  NOTIFICATION_TIMEOUT_MS,
  buildContactNotification,
  contactNotificationSubject,
  sendContactNotification,
  type ContactNotification,
} from '../src/lib/contact/notify.ts';
import {
  LIN_CHECK_TIMEOUT_MS,
  handOffToLinCheck,
  linCheckConfig,
  linCheckPayload,
  warnIfLinCheckUnconfigured,
} from '../src/lib/contact/lin-check.ts';
import {
  MAX_CONTACT_REQUEST_BYTES,
  handleContactNote,
  type ContactHandlerDeps,
} from '../src/lib/contact/handlers.ts';
import { NEWSLETTER_FROM } from '../src/lib/newsletter/email.ts';
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

  // The prompt is what a confirmation link renders: it posts the token instead
  // of acting on it, so a prefetch or a scanner cannot complete the change.
  const prompt = buildConfirmPromptPage('tok+en&<>"');
  assert.match(
    prompt,
    /<form method="post" action="\/api\/newsletter\/confirm">/,
  );
  assert.match(prompt, /<button class="cta" type="submit">/);
  assert.ok(
    prompt.includes('name="token" value="tok+en&amp;&lt;&gt;&quot;"'),
    'prompt escapes the token into the form field',
  );
  assert.doesNotMatch(prompt, /<script/i);
  assert.match(prompt, /<meta name="robots" content="noindex">/);
  assert.doesNotMatch(prompt, /cadence|weekly|monthly/i);
}

async function testConfirmRoute() {
  const original = { ...process.env };
  try {
    delete process.env.DATABASE_URL;
    delete process.env.DATABASE_URL_UNPOOLED;
    const { GET, POST } = await import(
      '../src/pages/api/newsletter/confirm.ts'
    );

    // GET renders the button page, and reaching it must not touch subscriber
    // state: no database call can happen, because no connection string exists.
    const prompt = await GET(
      minimalApiContext(
        new Request('https://leonlins.com/api/newsletter/confirm?token=abc'),
      ),
    );
    assert.equal(prompt.status, 200);
    assert.equal(prompt.headers.get('cache-control'), 'no-store');
    assert.equal(prompt.headers.get('referrer-policy'), 'no-referrer');
    const promptBody = await prompt.text();
    assert.match(promptBody, /Confirm your subscription\./);
    assert.ok(
      promptBody.includes('value="abc"'),
      'the prompt carries the token for the POST',
    );

    // POST runs the confirmation against the submitted token, and an
    // unavailable database fails visibly rather than reporting success.
    await assert.rejects(async () => {
      await POST(
        minimalApiContext(
          new Request('https://leonlins.com/api/newsletter/confirm', {
            method: 'POST',
            body: new URLSearchParams({ token: 'abc' }),
          }),
        ),
      );
    }, /Newsletter database is not configured/);
  } finally {
    process.env = original;
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

    // A valid confirmation activates exactly once, from pending or from a
    // resubscription, and never stores the raw token.
    const pendingHash = hashToken('good-token');
    let confirmations = 0;
    const confirmDb = makeFakeNewsletterDb((query) => {
      assert.match(query.text, /status IN \('pending', 'unsubscribed'\)/);
      assert.match(query.text, /confirmed_at/);
      assert.match(query.text, /confirmation_token_hash = NULL/);
      assert.match(query.text, /status = 'active'/);
      assert.doesNotMatch(
        query.text,
        /unsubscribed_at/,
        'a resubscription keeps the last cancellation time',
      );
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

    // A bounce or a complaint is a deliverability fact, so a signup request
    // leaves those rows, and already-active rows, completely alone.
    for (const status of ['active', 'bounced', 'complained']) {
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
      assert.deepEqual(response, genericSubscriptionResponse);
      assert.ok(
        suppressedDb.queries.every(
          (query) => !query.text.includes('INSERT INTO subscribers'),
        ),
        `${status} must not be rewritten`,
      );
    }

    // An unsubscribe is a preference, so it can be reversed — but only by a
    // fresh confirmation. The row keeps its unsubscribed status and its
    // first-touch attribution; the only write reissues the confirmation token.
    const resubscribeDb = makeFakeNewsletterDb((query) => {
      if (query.text.includes('newsletter_rate_limits'))
        return [{ attempt_count: 1 }];
      if (query.text.includes('SELECT status FROM subscribers'))
        return [{ status: 'unsubscribed' }];
      if (query.text.includes('INSERT INTO subscribers')) return [];
      throw new Error(`unexpected query for resubscription: ${query.text}`);
    });
    const resubscribeResponse = await requestSubscription(
      { email: 'person@example.com' },
      resubscribeDb.db,
    );
    assert.deepEqual(resubscribeResponse, genericSubscriptionResponse);
    const resubscribeWrites = resubscribeDb.queries.filter((query) =>
      query.text.includes('INSERT INTO subscribers'),
    );
    assert.equal(resubscribeWrites.length, 1);
    const resubscribe = resubscribeWrites[0];
    assert.match(
      resubscribe.text,
      /WHERE subscribers\.status IN \('pending', 'unsubscribed'\)/,
      'only a pending or unsubscribed row may be given a new token',
    );
    assert.doesNotMatch(
      resubscribe.text,
      /attribution|status = 'unsubscribed'|unsubscribed_at/,
      'resubmitting must not touch attribution or the recorded cancellation time',
    );
    const resubscribeHashes = resubscribe.values.filter(
      (value) => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value),
    );
    assert.equal(resubscribeHashes.length, 2);
    assert.ok(resubscribe.values.includes('person@example.com'));

    // Unsubscribing records the cancellation that just happened, so a
    // resubscription followed by a later cancellation is dated correctly, while
    // the guard on an already unsubscribed row keeps a repeat click from
    // restating the time it already recorded.
    const unsubscribeDb = makeFakeNewsletterDb(() => []);
    assert.equal(
      await unsubscribe('unsubscribe-token', unsubscribeDb.db),
      true,
    );
    assert.equal(unsubscribeDb.queries.length, 1);
    assert.match(
      unsubscribeDb.queries[0].text,
      /unsubscribed_at = CASE WHEN status = 'unsubscribed' THEN unsubscribed_at ELSE now\(\) END/,
      'only a live row records a new cancellation time',
    );
    assert.match(
      unsubscribeDb.queries[0].text,
      /status IN \('pending', 'active', 'unsubscribed'\)/,
      'a suppressed row is reachable only to clear a stale confirmation token',
    );
    assert.match(
      unsubscribeDb.queries[0].text,
      /confirmation_token_hash = NULL/,
      'a suppressed row must not keep a confirmation link that still works',
    );
    assert.ok(
      unsubscribeDb.queries[0].values.includes(hashToken('unsubscribe-token')),
    );

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

function fakeAttributionStorage(initial: Record<string, string> = {}) {
  const entries = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
    snapshot: () => Object.fromEntries(entries),
  };
}

function testNewsletterAttributionNormalization() {
  const x = normalizeAttribution({
    utmSource: 'X',
    utmMedium: 'Social',
    utmCampaign: 'Launch Thread',
  });
  assert.equal(x.source, 'x');
  assert.equal(x.detail, 'Launch Thread');
  assert.equal(x.utmSource, 'X', 'raw UTM values are preserved for auditing');

  const unknownHost = normalizeAttribution({
    utmSource: 'https://Example.com/post',
    referrerDomain: 'www.example.com',
  });
  assert.equal(unknownHost.source, 'referral');
  assert.equal(unknownHost.detail, 'https://Example.com/post');
  assert.equal(referrerDomain('https://www.example.com/post'), 'example.com');

  assert.equal(
    normalizeAttribution({ referrerDomain: 'news.ycombinator.com' }).source,
    'referral',
  );
  assert.equal(
    normalizeAttribution({ referrerDomain: 'news.ycombinator.com' }).detail,
    'news.ycombinator.com',
  );
  assert.equal(
    normalizeAttribution({ referrerDomain: 'google.co.uk' }).source,
    'organic_search',
  );
  assert.equal(
    normalizeAttribution({ referrerDomain: 'mail.google.com' }).source,
    'referral',
    'a Google product page is not a search',
  );
  assert.equal(
    normalizeAttribution({
      referrerDomain: 'leonlins.com',
      landingPath: '/writing/sample/?utm_source=leak#top',
    }).source,
    'leonlins.com',
  );
  assert.equal(
    normalizeAttribution({
      referrerDomain: 'leonlins.com',
      landingPath: '/writing/sample/?utm_source=leak#top',
    }).detail,
    '/writing/sample/',
  );
  assert.equal(normalizeAttribution({}).source, 'direct');
  assert.equal(normalizeAttribution({}).detail, null);
  assert.ok(isInformativeSource('reddit'));
  for (const tagged of ['mastodon', 'linkedin', 'farcaster', 'nostr'] as const)
    assert.equal(
      normalizeAttribution({ utmSource: tagged }).source,
      tagged,
      'a source the distribution pipeline tags reports as its own channel',
    );
  assert.ok(!isInformativeSource('direct'));
  assert.ok(!isInformativeSource('unknown'));
  assert.ok(
    !isInformativeSource('leonlins.com'),
    'an internal navigation must not block a later external touch',
  );
  assert.equal(
    normalizeAttribution({ utmSource: 'x'.repeat(400) }).utmSource?.length,
    100,
    'oversized UTM values are capped',
  );
}

function testNewsletterAttributionRequestShape() {
  assert.equal(attributionFromRequest(null), null);
  assert.equal(attributionFromRequest('string'), null);
  assert.equal(attributionFromRequest([]), null);
  assert.equal(attributionFromRequest({ other: 'value' }), null);
  assert.equal(
    attributionFromRequest({ utmSource: 5, utmCampaign: null }),
    null,
  );
  assert.deepEqual(
    attributionFromRequest({ utmSource: 'x', ignored: 'value' }),
    {
      utmSource: 'x',
      utmMedium: null,
      utmCampaign: null,
      utmContent: null,
      landingPath: null,
      referrerDomain: null,
    },
  );
}

function testNewsletterAttributionCapture() {
  const storage = fakeAttributionStorage();
  const first = firstTouchAttribution(
    {
      search: '?utm_source=x&utm_medium=social&utm_campaign=launch',
      pathname: '/writing/sample/',
      host: 'leonlins.com',
      referrer: 'https://t.co/abc',
    },
    storage,
    new Date('2026-01-01T00:00:00.000Z'),
  );
  assert.equal(first.utmCampaign, 'launch');
  assert.deepEqual(
    Object.keys(storage.snapshot()),
    [ATTRIBUTION_STORAGE_KEY],
    'the first touch is stored for later signups',
  );

  // A later unrelated visit must not overwrite a real first touch.
  const second = firstTouchAttribution(
    { search: '', pathname: '/', host: 'leonlins.com', referrer: '' },
    storage,
  );
  assert.equal(second.utmCampaign, 'launch');

  // An uninformative first touch is upgraded once a real source appears.
  const fresh = fakeAttributionStorage();
  firstTouchAttribution(
    { search: '', pathname: '/', host: 'leonlins.com', referrer: '' },
    fresh,
  );
  const upgraded = firstTouchAttribution(
    {
      search: '?utm_source=bluesky',
      pathname: '/writing/sample/',
      host: 'leonlins.com',
      referrer: '',
    },
    fresh,
  );
  assert.equal(normalizeAttribution(upgraded).source, 'bluesky');

  // An internal navigation is not an acquisition touch: it must not consume the
  // one upgrade, so a later external visit can still claim the first touch.
  const internal = fakeAttributionStorage();
  firstTouchAttribution(
    { search: '', pathname: '/', host: 'leonlins.com', referrer: '' },
    internal,
  );
  const navigated = firstTouchAttribution(
    {
      search: '',
      pathname: '/writing/sample/',
      host: 'leonlins.com',
      referrer: 'https://leonlins.com/',
    },
    internal,
  );
  assert.equal(
    normalizeAttribution(navigated).source,
    'direct',
    'a page view referred by the site itself is not a channel',
  );
  assert.equal(
    readStoredAttribution(internal)?.capture.landingPath,
    '/',
    'the stored first touch is left alone',
  );
  const arrived = firstTouchAttribution(
    {
      search: '?utm_source=x&utm_campaign=launch',
      pathname: '/writing/sample/',
      host: 'leonlins.com',
      referrer: 'https://t.co/abc',
    },
    internal,
  );
  assert.equal(
    normalizeAttribution(arrived).source,
    'x',
    'a real external touch still replaces an uninformative first touch',
  );

  // Storage failures must never break signup.
  const broken = {
    getItem: () => {
      throw new Error('storage disabled');
    },
    setItem: () => {
      throw new Error('storage disabled');
    },
  };
  assert.equal(
    firstTouchAttribution(
      { search: '', pathname: '/', host: 'leonlins.com', referrer: '' },
      broken,
    ).landingPath,
    '/',
  );
  assert.equal(readStoredAttribution(broken), null);

  const payload = attributionPayload({
    utmSource: 'x',
    utmCampaign: 'launch',
    landingPath: '/writing/sample/?utm_source=leak#top',
    referrerDomain: 'www.example.com',
  });
  assert.deepEqual(payload, {
    utmSource: 'x',
    utmCampaign: 'launch',
    landingPath: '/writing/sample/',
    // The wire payload keeps the raw host; the server normalizes it on write.
    referrerDomain: 'www.example.com',
  });
}

async function testNewsletterAttributionSignupWrite() {
  const original = { ...process.env };
  try {
    delete process.env.NEWSLETTER_CONFIRMATION_DELIVERY_ENABLED;
    delete process.env.NEWSLETTER_CONFIRMATION_PRODUCTION_ENABLED;
    const newSubscriberDb = () =>
      makeFakeNewsletterDb((query) => {
        if (query.text.includes('newsletter_rate_limits'))
          return [{ attempt_count: 1 }];
        if (query.text.includes('SELECT status FROM subscribers')) return [];
        if (query.text.includes('INSERT INTO subscribers')) return [];
        throw new Error(`unexpected query: ${query.text}`);
      });

    const withAttribution = newSubscriberDb();
    await requestSubscription(
      {
        email: 'reader@example.com',
        source: 'blog-inline',
        attribution: {
          utmSource: 'x',
          utmMedium: 'social',
          utmCampaign: 'launch',
          utmContent: 'hook-a',
          landingPath: '/writing/sample/',
          referrerDomain: 't.co',
          siteHost: 'leonlins.com',
        },
      },
      withAttribution.db,
    );
    const insert = withAttribution.queries.find((query) =>
      query.text.includes('INSERT INTO subscribers'),
    );
    assert.ok(insert);
    for (const column of [
      'acquisition_source',
      'acquisition_detail',
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_content',
      'signup_path',
      'referrer_domain',
    ])
      assert.ok(insert.text.includes(column), `INSERT must write ${column}`);
    assert.ok(insert.values.includes('x'), 'normalized source is written');
    assert.ok(insert.values.includes('launch'));
    assert.ok(
      insert.values.includes('blog-inline'),
      'form variant is preserved',
    );
    assert.ok(
      !insert.text.includes('utm_source = '),
      'the conflict branch must never overwrite attribution',
    );

    // A signup without attribution stores nulls rather than inventing a source.
    const withoutAttribution = newSubscriberDb();
    await requestSubscription(
      { email: 'quiet@example.com' },
      withoutAttribution.db,
    );
    const plainInsert = withoutAttribution.queries.find((query) =>
      query.text.includes('INSERT INTO subscribers'),
    );
    assert.ok(plainInsert);
    const attributionValues = plainInsert.values.slice(-8);
    assert.equal(attributionValues.length, 8);
    assert.equal(
      attributionValues.filter((value) => value === null).length,
      8,
      'attribution columns stay empty when no source is known',
    );
  } finally {
    process.env = original;
  }
}

function analyticsFixtureDb(fixture: {
  audience?: unknown[];
  growth?: unknown[];
  acquisition?: unknown[];
  delivery?: unknown[];
  sends?: unknown[];
}) {
  const queries: Array<{ text: string; values: unknown[] }> = [];
  const db: any = async (parts: TemplateStringsArray, ...values: unknown[]) => {
    const text = parts.join('\n');
    queries.push({ text, values });
    if (text.includes('GROUP BY status')) return fixture.audience ?? [];
    if (text.includes('prior_new_subscribers')) return fixture.growth ?? [];
    if (text.includes('current_count')) return fixture.acquisition ?? [];
    if (text.includes('newsletter_event_receipts'))
      return fixture.delivery ?? [];
    if (text.includes('campaign_recipients')) return fixture.sends ?? [];
    throw new Error(`unexpected analytics query: ${text}`);
  };
  return { db, queries };
}

function assertReadOnly(queries: Array<{ text: string }>) {
  for (const query of queries) {
    assert.match(
      query.text.trim(),
      /^SELECT/,
      'analytics must only read, never mutate',
    );
    assert.ok(
      !/\b(INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE)\b/i.test(query.text),
      `analytics query must stay read-only: ${query.text}`,
    );
  }
}

async function testNewsletterAnalyticsReport() {
  const now = new Date('2026-03-01T12:00:00.000Z');
  const active = analyticsFixtureDb({
    audience: [
      { status: 'active', count: 1204 },
      { status: 'pending', count: '3' },
      { status: 'unsubscribed', count: 88 },
      { status: 'bounced', count: 4 },
      { status: 'complained', count: 1 },
      { status: 'legacy', count: 9 },
    ],
    growth: [
      {
        new_subscribers: 42,
        prior_new_subscribers: 12,
        new_subscribers_30: 178,
        unsubscribed: 6,
        prior_unsubscribed: 1,
        unsubscribed_30: 14,
      },
    ],
    acquisition: [
      { source: 'x', detail: 'launch-2026', current_count: 18, prior_count: 4 },
      {
        source: 'reddit',
        detail: 'r/creativecoding',
        current_count: 9,
        prior_count: 2,
      },
      { source: 'direct', detail: '/', current_count: 4, prior_count: 3 },
      {
        source: 'not-a-source',
        detail: 'typo-detail',
        current_count: 2,
        prior_count: 0,
      },
    ],
    delivery: [{ deliveries: 40, bounced: 1, complained: 0 }],
    sends: [{ sends: 40 }],
  });
  const metrics = await collectNewsletterMetrics(active.db, { days: 7, now });
  assertReadOnly(active.queries);
  assert.equal(active.queries.length, 5);
  assert.ok(
    active.queries.some((query) => query.text.includes('AS receipts')),
    'the total receipt count feeds the ingestion switch',
  );
  assert.ok(
    active.queries.some((query) =>
      query.text.includes('AS sends_before_delivery_grace'),
    ),
    'sends past the delivery grace period are counted separately',
  );
  assert.equal(metrics.audience.total, 1309, 'unknown statuses still count');
  assert.equal(metrics.audience.active, 1204);
  assert.equal(metrics.audience.pending, 3);
  assert.equal(metrics.growth.newSubscribers, 42);
  assert.equal(metrics.growth.netChange, 36);
  assert.equal(metrics.growth.unsubscribeRate, 6 / 40);
  assert.equal(metrics.deliverability.sends, 40);
  assert.equal(metrics.deliverability.bounceRate, 0.025);
  assert.equal(metrics.deliverability.complaintRate, 0);
  assert.equal(metrics.windowStart, '2026-02-22T12:00:00.000Z');
  assert.equal(metrics.windowEnd, '2026-03-01T12:00:00.000Z');
  assert.equal(metrics.sharesWithheld, false);
  assert.deepEqual(
    metrics.acquisition.map((entry) => [entry.source, entry.count]),
    [
      ['x', 18],
      ['reddit', 9],
      ['direct', 4],
      ['unknown', 2],
    ],
  );
  assert.equal(metrics.acquisition[0].share, 0.5455);
  assert.equal(
    metrics.acquisition[1].share,
    0.2727,
    'shares are only reported once the sample is large enough',
  );
  assert.deepEqual(metrics.acquisitionDetails, [
    { detail: 'launch-2026', count: 18 },
    { detail: 'r/creativecoding', count: 9 },
  ]);
  assert.ok(
    metrics.alerts.some((alert) => alert.includes('Bounce rate 2.50%')),
    'bounce threshold is reported',
  );
  assert.ok(
    metrics.alerts.some((alert) => alert.includes('Unsubscribes rose')),
    'unsubscribe spike is reported',
  );
  assert.ok(
    metrics.notes.some((note) =>
      note.startsWith(
        'x acquisition is above baseline: 18 in the last 7 days vs 4 in the prior 7 days',
      ),
    ),
    'acquisition surge is reported against the prior window',
  );
  // Only a deliverability condition fails the scheduled check: an unsubscribe
  // spike is worth reading, not worth a weekly red run.
  assert.deepEqual(metrics.failures, [
    'Bounce rate 2.50% of 40 sends is at or above the 2% SES investigation threshold.',
  ]);
  assert.ok(
    metrics.failures.some((failure) => metrics.alerts.includes(failure)),
    'every failure is also reported as an alert',
  );

  const report = renderNewsletterReport(metrics);
  assert.equal(
    report,
    renderNewsletterReport(metrics),
    'report is deterministic',
  );
  for (const section of [
    'AUDIENCE (all subscribers)',
    'GROWTH (last 7 days)',
    'ACQUISITION (last 7 days)',
    'DELIVERABILITY (last 7 days)',
    'QUALITY',
    'ENGAGEMENT',
    'NOTABLE CHANGE',
  ])
    assert.ok(report.includes(section), `report must include ${section}`);
  assert.ok(report.includes('Window: last 7×24h'));
  assert.ok(report.includes('15.00% of 40 sends'));
  assert.ok(report.includes('free-only'));
  assert.ok(report.includes('not tracked'));
  assert.ok(
    report.includes('top details: launch-2026 18 · r/creativecoding 9'),
  );
  assert.ok(!report.includes('not-a-source'), 'unknown sources are normalized');

  // A quiet window with no sends must not divide by zero or invent shares.
  const quiet = analyticsFixtureDb({
    audience: [{ status: 'active', count: 10 }],
    growth: [],
    acquisition: [
      { source: 'direct', detail: '/', current_count: 3, prior_count: 0 },
      { source: null, detail: null, current_count: 1, prior_count: 0 },
    ],
    delivery: [],
    sends: [],
  });
  const quietMetrics = await collectNewsletterMetrics(quiet.db, {
    days: 7,
    now,
  });
  assertReadOnly(quiet.queries);
  assert.deepEqual(
    quietMetrics.failures,
    [],
    'a week without a campaign is reported, not failed',
  );
  assert.ok(
    quietMetrics.alerts.includes('No campaign was sent in the last 7 days.'),
  );
  assert.equal(quietMetrics.growth.newSubscribers, 0);
  assert.equal(quietMetrics.deliverability.sends, 0);
  assert.equal(quietMetrics.growth.unsubscribeRate, null);
  assert.equal(quietMetrics.sharesWithheld, true);
  assert.ok(quietMetrics.acquisition.every((entry) => entry.share === null));
  const quietReport = renderNewsletterReport(quietMetrics);
  assert.ok(quietReport.includes('n/a (no sends in window)'));
  assert.ok(
    quietReport.includes(`shares withheld: fewer than ${MIN_SHARE_SAMPLE}`),
  );
  assert.ok(quietReport.includes('No campaign was sent in the last 7 days.'));

  // Complaint rate crosses the SES threshold while a 1.9% bounce rate does not.
  const complaints = analyticsFixtureDb({
    audience: [],
    growth: [{ new_subscribers: 5, prior_new_subscribers: 5 }],
    acquisition: [],
    delivery: [{ deliveries: 1000, bounced: 19, complained: 2 }],
    sends: [{ sends: 1000 }],
  });
  const complaintMetrics = await collectNewsletterMetrics(complaints.db, {
    days: 7,
    now,
  });
  assertReadOnly(complaints.queries);
  assert.equal(complaintMetrics.deliverability.complaintRate, 0.002);
  assert.deepEqual(complaintMetrics.failures, [
    'Complaint rate 0.20% of 1,000 sends is at or above the 0.1% SES investigation threshold.',
  ]);
  assert.ok(
    complaintMetrics.alerts.some((alert) =>
      alert.includes('Complaint rate 0.20%'),
    ),
  );
  assert.ok(
    !complaintMetrics.alerts.some((alert) => alert.includes('Bounce rate')),
    'a 1.9% bounce rate stays below the alert threshold',
  );
  const complaintReport = renderNewsletterReport(complaintMetrics);
  assert.ok(complaintReport.includes('⚠ Complaint rate 0.20%'));
  assert.ok(!complaintReport.includes('nothing outside the expected range'));
  assert.ok(
    complaintMetrics.notes.some((note) =>
      note.includes('excludes 21 bounces and complaints'),
    ),
    'net change discloses the events it does not count',
  );

  // A window that is not a week must compare window counts with the same-length
  // window rather than measuring a count against a weekly rate.
  const monthly = analyticsFixtureDb({
    audience: [],
    growth: [
      {
        new_subscribers: 14,
        prior_new_subscribers: 20,
        unsubscribed: 5,
        prior_unsubscribed: 6,
      },
    ],
    acquisition: [
      { source: 'x', detail: null, current_count: 14, prior_count: 20 },
    ],
    delivery: [{ deliveries: 100, bounced: 0, complained: 0 }],
    sends: [{ sends: 100 }],
  });
  const monthlyMetrics = await collectNewsletterMetrics(monthly.db, {
    days: 30,
    now,
  });
  assert.deepEqual(monthlyMetrics.notes, []);
  assert.deepEqual(
    monthlyMetrics.failures,
    [],
    'a window inside its thresholds must pass the check',
  );
  assert.ok(
    !monthlyMetrics.alerts.some((alert) => alert.includes('Unsubscribes rose')),
    '5 unsubscribes is below the 6 of the prior 30 days',
  );

  // Below the sample floor the rates are reported but not compared with the
  // account-level SES thresholds.
  const smallSample = analyticsFixtureDb({
    audience: [],
    growth: [],
    acquisition: [],
    delivery: [{ deliveries: 8, bounced: 2, complained: 0 }],
    sends: [{ sends: 10 }],
  });
  const smallSampleMetrics = await collectNewsletterMetrics(smallSample.db, {
    days: 7,
    now,
  });
  assert.equal(smallSampleMetrics.deliverability.bounceRate, 0.2);
  assert.ok(
    !smallSampleMetrics.alerts.some((alert) => alert.includes('Bounce rate')),
    '2 bounces of 10 sends is not comparable to an account-level threshold',
  );
  assert.ok(
    smallSampleMetrics.notes.some((note) => note.includes('cover 10 sends')),
  );
  assert.deepEqual(
    smallSampleMetrics.failures,
    [],
    'a rate below the comparable sample is not a failure',
  );

  // Delivery events whose send falls outside the window are reported, never
  // failed: the EXISTS join proves a matching send row exists, so this is a late
  // or retried event rather than a broken ingestion path.
  const unreconciled = analyticsFixtureDb({
    audience: [],
    growth: [],
    acquisition: [],
    delivery: [{ deliveries: 0, bounced: 1, complained: 0 }],
    sends: [],
  });
  const unreconciledMetrics = await collectNewsletterMetrics(unreconciled.db, {
    days: 7,
    now,
  });
  assert.ok(
    unreconciledMetrics.alerts.includes(
      'Delivery events (1) arrived in the last 7 days for a campaign sent outside that window, so no rate could be computed.',
    ),
  );
  assert.deepEqual(
    unreconciledMetrics.failures,
    [],
    'an out-of-window receipt is evidence, not a deliverability failure',
  );

  // The ingestion dead-man's switch: sends past the one-hour grace period with
  // no correlated receipt of any kind mean events stopped arriving.
  const silentIngestion = analyticsFixtureDb({
    audience: [],
    growth: [],
    acquisition: [],
    delivery: [{ receipts: 0, deliveries: 0, bounced: 0, complained: 0 }],
    sends: [{ sends: 40, sends_before_delivery_grace: 40 }],
  });
  const silentMetrics = await collectNewsletterMetrics(silentIngestion.db, {
    days: 7,
    now,
  });
  assert.deepEqual(silentMetrics.failures, [
    'Delivery-event ingestion may have stopped: 40 sends in this window are past the one-hour grace period and no SES event receipt has been correlated to them.',
  ]);
  assert.ok(
    renderNewsletterReport(silentMetrics).includes(
      'Delivery-event ingestion may have stopped',
    ),
  );

  // One receipt of any status proves ingestion is alive, and a send that is
  // still inside the grace period has not had time to produce one.
  const oneReceipt = analyticsFixtureDb({
    audience: [],
    growth: [],
    acquisition: [],
    delivery: [{ receipts: 1, deliveries: 1, bounced: 0, complained: 0 }],
    sends: [{ sends: 40, sends_before_delivery_grace: 40 }],
  });
  assert.deepEqual(
    (await collectNewsletterMetrics(oneReceipt.db, { days: 7, now })).failures,
    [],
    'a single correlated receipt proves ingestion is alive',
  );

  const insideGrace = analyticsFixtureDb({
    audience: [],
    growth: [],
    acquisition: [],
    delivery: [{ receipts: 0, deliveries: 0, bounced: 0, complained: 0 }],
    sends: [{ sends: 40, sends_before_delivery_grace: 0 }],
  });
  assert.deepEqual(
    (await collectNewsletterMetrics(insideGrace.db, { days: 7, now })).failures,
    [],
    'a send inside the grace period has not had time to produce a receipt',
  );
}

// A route handler reads only `request` and `url` out of the Astro context.
function minimalApiContext(request: Request) {
  return { request, url: new URL(request.url) } as any;
}

async function withCapturedLogs(
  run: () => Promise<void>,
): Promise<unknown[][]> {
  const calls: unknown[][] = [];
  const originalError = console.error;
  const originalWarn = console.warn;
  console.error = (...args: unknown[]) => {
    calls.push(args);
  };
  console.warn = (...args: unknown[]) => {
    calls.push(args);
  };
  try {
    await run();
  } finally {
    console.error = originalError;
    console.warn = originalWarn;
  }
  return calls;
}

function newsletterAlertLogs(calls: unknown[][]) {
  return calls.filter((call) => call[0] === 'newsletter_alert');
}

async function testNewsletterAlerting() {
  // Failure-only: one structured line, and only the fields that are allowed.
  const calls = await withCapturedLogs(async () => {
    newsletterAlert('signup_pipeline_failure', { errorName: 'TypeError' });
    const smuggled: NewsletterAlertFields & { email: string } = {
      reason: 'processing',
      email: 'reader@example.com',
    };
    newsletterAlert('ses_event_ingestion_failure', smuggled);
    newsletterAlert('analytics_job_failure');
  });
  assert.deepEqual(calls, [
    [
      'newsletter_alert',
      { kind: 'signup_pipeline_failure', errorName: 'TypeError' },
    ],
    [
      'newsletter_alert',
      { kind: 'ses_event_ingestion_failure', reason: 'processing' },
    ],
    ['newsletter_alert', { kind: 'analytics_job_failure' }],
  ]);
  assert.equal(
    JSON.stringify(calls).includes('reader@example.com'),
    false,
    'no identifier may reach an alert',
  );

  // A failing signup pipeline is alerted on, and the caller still learns
  // nothing about the address.
  const original = { ...process.env };
  try {
    delete process.env.DATABASE_URL;
    delete process.env.DATABASE_URL_UNPOOLED;
    const { POST } = await import('../src/pages/api/newsletter/subscribe.ts');
    const failing = await withCapturedLogs(async () => {
      const response = await POST(
        minimalApiContext(
          new Request('https://leonlins.com/api/newsletter/subscribe', {
            method: 'POST',
            body: JSON.stringify({ email: 'reader@example.com' }),
          }),
        ),
      );
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), genericSubscriptionResponse);
    });
    assert.deepEqual(newsletterAlertLogs(failing), [
      [
        'newsletter_alert',
        { kind: 'signup_pipeline_failure', errorName: 'Error' },
      ],
    ]);

    // A malformed body is a client mistake, not a pipeline failure.
    const junk = await withCapturedLogs(async () => {
      for (const body of ['not json', 'null', '"text"']) {
        const response = await POST(
          minimalApiContext(
            new Request('https://leonlins.com/api/newsletter/subscribe', {
              method: 'POST',
              body,
            }),
          ),
        );
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), genericSubscriptionResponse);
      }
    });
    assert.deepEqual(newsletterAlertLogs(junk), []);

    // A missing topic means no event can ever be ingested, whichever sender
    // sends it, so that is alerted on as a configuration failure.
    delete process.env.NEWSLETTER_SNS_TOPIC_ARN;
    const { POST: sesPost } = await import(
      '../src/pages/api/newsletter/ses-events.ts'
    );
    const unconfigured = await withCapturedLogs(async () => {
      const response = await sesPost(
        minimalApiContext(
          new Request('https://leonlins.com/api/newsletter/ses-events', {
            method: 'POST',
            body: '{}',
          }),
        ),
      );
      assert.equal(response.status, 400);
    });
    assert.deepEqual(newsletterAlertLogs(unconfigured), [
      [
        'newsletter_alert',
        {
          kind: 'ses_event_ingestion_failure',
          reason: 'configuration',
          errorName: 'Error',
        },
      ],
    ]);

    // An unauthenticated payload is junk internet traffic, not an incident.
    process.env.NEWSLETTER_SNS_TOPIC_ARN =
      'arn:aws:sns:us-east-1:123456789012:newsletter';
    const unauthenticated = await withCapturedLogs(async () => {
      const response = await sesPost(
        minimalApiContext(
          new Request('https://leonlins.com/api/newsletter/ses-events', {
            method: 'POST',
            body: 'not-a-sns-envelope',
          }),
        ),
      );
      assert.equal(response.status, 400);
    });
    assert.deepEqual(newsletterAlertLogs(unauthenticated), []);
  } finally {
    process.env = original;
  }
}

async function testAnalyticsCheckContract() {
  const withFailures = (failures: string[]) =>
    ({ failures }) as unknown as Parameters<typeof newsletterCheckExitCode>[0];

  // A failing check names every failure it exits on and alerts once.
  const failing = await withCapturedLogs(async () => {
    assert.equal(
      newsletterCheckExitCode(
        withFailures([
          'Bounce rate 10.00% of 10 sends is at or above the 2% SES investigation threshold.',
        ]),
      ),
      1,
    );
  });
  assert.deepEqual(newsletterAlertLogs(failing), [
    [
      'newsletter_alert',
      { kind: 'analytics_job_failure', reason: 'threshold' },
    ],
  ]);
  assert.deepEqual(failing.slice(1), [
    [
      '  Bounce rate 10.00% of 10 sends is at or above the 2% SES investigation threshold.',
    ],
  ]);

  // A clean report exits zero and stays silent, so a weekly run only ever
  // notifies when something is wrong.
  const passing = await withCapturedLogs(async () => {
    assert.equal(newsletterCheckExitCode(withFailures([])), 0);
  });
  assert.deepEqual(passing, []);

  // A collection failure is alerted on in both places, but only a local run may
  // see the driver's message: it can quote the connection string back, and a CI
  // log is published in a public repository.
  const driverError = new Error(
    'Database connection string provided to `neon()` is not a valid URL. Connection string: postgres://user:secret@example.com/db',
  );
  const original = { ...process.env };
  try {
    process.env.CI = 'true';
    const ci = await withCapturedLogs(async () => {
      assert.equal(reportAnalyticsCollectionFailure(driverError), true);
    });
    assert.deepEqual(newsletterAlertLogs(ci), [
      [
        'newsletter_alert',
        {
          kind: 'analytics_job_failure',
          reason: 'collection',
          errorName: 'Error',
        },
      ],
    ]);
    assert.deepEqual(ci.slice(1), [
      [
        '  Analytics collection failed; run the report locally for the error text.',
      ],
    ]);
    assert.equal(
      JSON.stringify(ci).includes('secret'),
      false,
      'the driver message must never reach a CI log',
    );

    delete process.env.CI;
    const local = await withCapturedLogs(async () => {
      assert.equal(reportAnalyticsCollectionFailure(driverError), false);
    });
    assert.equal(
      local.length,
      1,
      'outside CI the rethrown error is the diagnostic, not a printed line',
    );
  } finally {
    process.env = original;
  }
}

function sesEnvelope(event: Record<string, unknown>, messageId = 'sns-1') {
  return {
    Type: 'Notification',
    MessageId: messageId,
    TopicArn: 'arn:aws:sns:us-east-1:123456789012:newsletter',
    Message: JSON.stringify(event),
    Timestamp: '2026-03-01T12:00:00.000Z',
    SignatureVersion: '1',
    Signature: 'signature',
    SigningCertURL: 'https://sns.us-east-1.amazonaws.com/cert.pem',
  } as unknown as Parameters<typeof recordSesEvent>[0];
}

async function testSesEventIngestionAlerts() {
  const event = (overrides: Record<string, unknown>) => ({
    eventType: 'Delivery',
    mail: { messageId: 'ses-1', destination: ['reader@example.com'] },
    delivery: { timestamp: '2026-03-01T12:00:00.000Z' },
    ...overrides,
  });

  // A delivery with no message id cannot be correlated, so it is alerted on —
  // and the receipt is still recorded, so a retry is still deduplicated.
  const uncorrelated = makeFakeNewsletterDb(() => []);
  const uncorrelatedLogs = await withCapturedLogs(async () => {
    await recordSesEvent(
      sesEnvelope(event({ mail: { destination: ['reader@example.com'] } })),
      uncorrelated.db,
    );
  });
  assert.deepEqual(newsletterAlertLogs(uncorrelatedLogs), [
    [
      'newsletter_alert',
      { kind: 'ses_event_ingestion_failure', reason: 'uncorrelated' },
    ],
  ]);
  assert.equal(uncorrelated.queries.length, 1);
  assert.match(
    uncorrelated.queries[0].text,
    /INSERT INTO newsletter_event_receipts/,
  );

  // A correlated delivery is ordinary ingestion.
  const correlated = makeFakeNewsletterDb(() => []);
  const correlatedLogs = await withCapturedLogs(async () => {
    await recordSesEvent(sesEnvelope(event({})), correlated.db);
  });
  assert.deepEqual(newsletterAlertLogs(correlatedLogs), []);
  assert.equal(correlated.queries.length, 1);

  for (const ignored of [
    // A transient bounce is not a subscriber state change.
    event({
      eventType: 'Bounce',
      bounce: {
        bounceType: 'Transient',
        timestamp: '2026-03-01T12:00:00.000Z',
        bouncedRecipients: [{ emailAddress: 'reader@example.com' }],
      },
      mail: { destination: ['reader@example.com'] },
    }),
    // Neither is an event type the newsletter does not act on.
    event({ eventType: 'Open', mail: { destination: ['reader@example.com'] } }),
  ]) {
    const ignoredDb = makeFakeNewsletterDb(() => []);
    const ignoredLogs = await withCapturedLogs(async () => {
      await recordSesEvent(sesEnvelope(ignored), ignoredDb.db);
    });
    assert.deepEqual(newsletterAlertLogs(ignoredLogs), []);
  }

  // A permanent bounce without a message id still alerts, because the
  // suppression it implies never happened.
  const uncorrelatedBounce = makeFakeNewsletterDb(() => []);
  const bounceLogs = await withCapturedLogs(async () => {
    await recordSesEvent(
      sesEnvelope(
        event({
          eventType: 'Bounce',
          bounce: {
            bounceType: 'Permanent',
            timestamp: '2026-03-01T12:00:00.000Z',
            bouncedRecipients: [{ emailAddress: 'reader@example.com' }],
          },
          mail: { destination: ['reader@example.com'] },
        }),
      ),
      uncorrelatedBounce.db,
    );
  });
  assert.deepEqual(newsletterAlertLogs(bounceLogs), [
    [
      'newsletter_alert',
      { kind: 'ses_event_ingestion_failure', reason: 'uncorrelated' },
    ],
  ]);
}

function testNewsletterReportWindow() {
  assert.equal(validateReportWindow(1), 1);
  assert.equal(
    validateReportWindow(MAX_REPORT_WINDOW_DAYS),
    MAX_REPORT_WINDOW_DAYS,
  );
  for (const days of [0, -1, 1.5, MAX_REPORT_WINDOW_DAYS + 1, Number.NaN])
    assert.throws(() => validateReportWindow(days));
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

function makeFakeDb(
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
function makeForbiddenDb() {
  return makeFakeDb(() => {
    throw new Error('the handler must not query the database for this request');
  });
}

/** The single recorded query whose SQL matches `pattern`. */
function soleQuery(
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

function testContactDomain() {
  // A name lands in an email subject, so it collapses to one line with no
  // control characters.
  assert.equal(normalizeContactName('  Leon \n\n Lin  '), 'Leon Lin');
  assert.equal(normalizeContactName('Leon\u0000Lin'), 'LeonLin');
  // C1 controls go with C0. U+0085 NEL matters most: some mail software reads it
  // as a line break while JavaScript's `\s` does not, so leaving it in would let
  // a header-shaped name through the collapse.
  assert.equal(normalizeContactName('Leon\u0085Lin'), 'LeonLin');
  assert.equal(normalizeContactName('Leon\u009bLin'), 'LeonLin');
  assert.equal(normalizeContactName('   '), '');
  assert.equal(normalizeContactName(42), '');

  // The reply address is kept exactly as typed apart from surrounding space: it
  // identifies one person to reply to, not a stored identity key.
  assert.equal(
    normalizeContactEmail('  Leon@Example.COM '),
    'Leon@Example.COM',
  );
  assert.equal(normalizeContactEmail(undefined), '');
  // A C1 control cannot reach SES as a reply address, which would reject it.
  assert.equal(
    normalizeContactEmail('leon\u0085@example.com'),
    'leon@example.com',
  );

  // A message keeps its paragraphs, on one line-ending convention.
  assert.equal(
    normalizeContactMessage('  one\r\ntwo\r\n\r\nthree  '),
    'one\ntwo\n\nthree',
  );
  assert.equal(normalizeContactMessage(null), '');

  // Every field is required and length-limited, and the order of the checks
  // decides which single error the reader sees.
  assert.deepEqual(
    validateContactNote({
      name: '   ',
      email: 'leon@example.com',
      message: 'hi',
    }),
    { ok: false, error: 'name_required' },
  );
  assert.deepEqual(
    validateContactNote({
      name: 'a'.repeat(MAX_CONTACT_NAME_LENGTH + 1),
      email: 'leon@example.com',
      message: 'hi',
    }),
    { ok: false, error: 'name_too_long' },
  );
  assert.deepEqual(
    validateContactNote({ name: 'Leon', email: '', message: 'hi' }),
    { ok: false, error: 'email_required' },
  );
  assert.deepEqual(
    validateContactNote({
      name: 'Leon',
      email: 'not-an-address',
      message: 'hi',
    }),
    { ok: false, error: 'email_invalid' },
  );
  assert.deepEqual(
    validateContactNote({
      name: 'Leon',
      email: `${'a'.repeat(MAX_CONTACT_EMAIL_LENGTH)}@example.com`,
      message: 'hi',
    }),
    { ok: false, error: 'email_too_long' },
  );
  assert.deepEqual(
    validateContactNote({
      name: 'Leon',
      email: 'leon@example.com',
      message: '   ',
    }),
    { ok: false, error: 'message_required' },
  );
  assert.deepEqual(
    validateContactNote({
      name: 'Leon',
      email: 'leon@example.com',
      message: 'a'.repeat(MAX_CONTACT_MESSAGE_LENGTH + 1),
    }),
    { ok: false, error: 'message_too_long' },
  );

  // The value that comes back is the value that gets stored and mailed, so what
  // was checked is what is used.
  assert.deepEqual(
    validateContactNote({
      name: ' Leon  Lin ',
      email: ' Leon@Example.com ',
      message: ' hello\r\nworld ',
    }),
    {
      ok: true,
      value: {
        name: 'Leon Lin',
        email: 'Leon@Example.com',
        message: 'hello\nworld',
      },
    },
  );

  // The limits are inclusive, and a non-string field never validates.
  assert.equal(
    validateContactNote({
      name: 'a'.repeat(MAX_CONTACT_NAME_LENGTH),
      email: 'leon@example.com',
      message: 'a'.repeat(MAX_CONTACT_MESSAGE_LENGTH),
    }).ok,
    true,
  );
  assert.deepEqual(validateContactNote({ name: 1, email: {}, message: [] }), {
    ok: false,
    error: 'name_required',
  });

  // Only the path of this site's own page is kept; a full URL, a query string, or
  // anything else is reported as unknown rather than recorded as if it meant
  // something.
  assert.equal(normalizeSourcePage('/now'), '/now');
  assert.equal(normalizeSourcePage('  /about  '), '/about');
  assert.equal(
    normalizeSourcePage('/writing/some-post/'),
    '/writing/some-post/',
  );
  assert.equal(
    normalizeSourcePage('https://leonlins.com/now'),
    UNKNOWN_SOURCE_PAGE,
  );
  assert.equal(
    normalizeSourcePage('/now?utm_source=newsletter'),
    UNKNOWN_SOURCE_PAGE,
  );
  assert.equal(
    normalizeSourcePage(`/${'a'.repeat(MAX_CONTACT_SOURCE_LENGTH + 1)}`),
    UNKNOWN_SOURCE_PAGE,
  );
  assert.equal(
    normalizeSourcePage(`/${'a'.repeat(MAX_CONTACT_SOURCE_LENGTH - 1)}`),
    `/${'a'.repeat(MAX_CONTACT_SOURCE_LENGTH - 1)}`,
  );
  assert.equal(normalizeSourcePage(''), UNKNOWN_SOURCE_PAGE);
  assert.equal(normalizeSourcePage(null), UNKNOWN_SOURCE_PAGE);

  // Every error the API can return carries copy, a status the form can explain,
  // and the one field the browser should focus.
  for (const [code, entry] of Object.entries(contactErrors)) {
    assert.ok(entry.message.length > 0, `${code} needs a message`);
    assert.ok(
      [400, 403, 413, 503].includes(entry.status),
      `${code} must use a status the form can explain`,
    );
    if (entry.status >= 500 || entry.status === 413)
      assert.equal(entry.field, null, `${code} cannot name a field to fix`);
  }
  for (const code of ['name_required', 'name_too_long'] as const)
    assert.equal(contactErrors[code].field, 'name');
  for (const code of [
    'email_required',
    'email_invalid',
    'email_too_long',
  ] as const)
    assert.equal(contactErrors[code].field, 'email');
  for (const code of ['message_required', 'message_too_long'] as const)
    assert.equal(contactErrors[code].field, 'message');
  for (const code of ['invalid_request', 'too_large', 'cross_site'] as const)
    assert.equal(contactErrors[code].status < 500, true);
  // The errors that leave the reader without a confirmed send always name the
  // address that still works, because the form is never the only way to write
  // in — including the two states only the browser can reach.
  for (const code of [
    'verification_required',
    'verification_failed',
    'invalid_request',
    'too_large',
    'unavailable',
    'delivery_failed',
    'send_unconfirmed',
  ] as const)
    assert.ok(
      contactErrors[code].message.includes(CONTACT_EMAIL),
      `${code} must point at the address that always works`,
    );
}

const CONTACT_URL = 'https://leonlins.com/api/contact';
const CONTACT_ID = '2b0e5a2f-1c1a-4f0e-9f4d-5b3a7c1d2e3f';
const CONTACT_NOTE = {
  name: 'Leon Lin',
  email: 'leon@example.com',
  message: 'Hello from the site',
  note_origin: '',
  turnstileToken: 'token',
};

/** A fake database that answers an insert with the stored row and an update with nothing. */
function contactDbStub() {
  return makeFakeDb((query) =>
    /INSERT INTO contact_submissions/.test(query.text)
      ? [{ id: CONTACT_ID, created_at: '2026-09-17T10:00:00.000Z' }]
      : [],
  );
}

function contactDeps(
  overrides: Partial<ContactHandlerDeps> = {},
): ContactHandlerDeps {
  return {
    db: contactDbStub().db,
    turnstileSecret: 'secret',
    fetchImpl: verifiedTurnstileFetch,
    env: {},
    notify: async () => {},
    ...overrides,
  };
}

/**
 * Turnstile's `siteverify` goes to `handleSiteverify` (which verifies by default)
 * and every other call goes to `handleOther`.
 */
function contactFetch(
  handleOther: (url: string, init?: RequestInit) => Promise<Response>,
  handleSiteverify: (
    url: string,
    init?: RequestInit,
  ) => Promise<Response> = async () =>
    new Response(JSON.stringify({ success: true }), { status: 200 }),
): typeof fetch {
  return (async (url: string, init?: RequestInit) =>
    String(url).includes('siteverify')
      ? handleSiteverify(String(url), init)
      : handleOther(String(url), init)) as unknown as typeof fetch;
}

/** A fetch that refuses to be called, for cases that must stop before the network. */
const forbiddenFetch = (async () => {
  throw new Error('this request must not reach the network');
}) as unknown as typeof fetch;

function postContactNote(
  payload: Record<string, unknown>,
  deps: ContactHandlerDeps,
  headers: Record<string, string> = {},
) {
  return handleContactNote(
    new Request(CONTACT_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://leonlins.com',
        ...headers,
      },
      body: JSON.stringify(payload),
    }),
    deps,
  );
}

type SentEmail = {
  input: {
    FromEmailAddress?: string;
    ReplyToAddresses?: string[];
    ConfigurationSetName?: string;
    Destination: { ToAddresses?: string[] };
    Content: {
      Simple: {
        Subject: { Data: string };
        Body: { Text: { Data: string }; Html: { Data: string } };
      };
    };
  };
};

async function testContactNotifications() {
  const note: ContactNotification = {
    id: CONTACT_ID,
    name: 'Leon Lin',
    email: 'leon@example.com',
    message: 'Hello\n<world>',
    sourcePage: '/now',
    receivedAt: '2026-09-17T10:00:00.000Z',
  };

  // The subject names the sender and, when it is known, the page they wrote from.
  assert.equal(
    contactNotificationSubject(note),
    'New note from Leon Lin - /now',
  );
  assert.equal(
    contactNotificationSubject({
      name: 'Leon',
      sourcePage: UNKNOWN_SOURCE_PAGE,
    }),
    'New note from Leon',
  );
  assert.equal(
    contactNotificationSubject({ name: 'Leon', sourcePage: '' }),
    'New note from Leon',
  );
  // A subject is a header: a name with newlines must not be able to inject a
  // second header, which is why the name is collapsed before it arrives here.
  assert.ok(
    // eslint-disable-next-line no-control-regex -- asserting that no control character survives is the point.
    !/[\r\n\u0000-\u001f\u007f-\u009f]/.test(
      contactNotificationSubject({
        name: normalizeContactName('Leon\nBcc: someone@example.com'),
        sourcePage: '/now',
      }),
    ),
  );

  const bodies = buildContactNotification(note);
  assert.equal(bodies.subject, contactNotificationSubject(note));
  for (const fragment of [
    'Leon Lin',
    'leon@example.com',
    '/now',
    '2026-09-17T10:00:00.000Z',
    'Hello',
  ])
    assert.ok(bodies.text.includes(fragment), `text is missing ${fragment}`);
  assert.ok(bodies.text.includes('Reply to this email'));

  // The message is prose someone else wrote, so it is escaped and pre-wrapped,
  // and the mail carries no images, links, or tracking of any kind.
  assert.ok(!bodies.html.includes('<world>'));
  assert.ok(bodies.html.includes('&lt;world&gt;'));
  assert.match(bodies.html, /white-space: pre-wrap/);
  assert.ok(!/<(a|img|iframe|script|link)\b/i.test(bodies.html));
  assert.ok(!/https?:\/\//.test(bodies.html));

  // One verified sending identity, with the person who wrote in as Reply-To, so
  // answering the notification answers them.
  const sent: SentEmail[] = [];
  const sendOptions: unknown[] = [];
  await sendContactNotification(note, {
    client: {
      send: async (command: unknown, options?: unknown) => {
        sent.push(command as SentEmail);
        sendOptions.push(options);
        return {};
      },
    },
  });
  assert.equal(sent.length, 1);
  // The send carries a deadline of its own, so a stalled connection ends in a
  // visible failure rather than a request that outlives the reader's patience.
  assert.ok(
    (sendOptions[0] as { abortSignal?: AbortSignal } | undefined)
      ?.abortSignal instanceof AbortSignal,
    'the notification send must be bounded by a deadline',
  );
  assert.ok(NOTIFICATION_TIMEOUT_MS > 0);
  const { input } = sent[0] as SentEmail;
  assert.equal(input.FromEmailAddress, NEWSLETTER_FROM);
  assert.deepEqual(input.ReplyToAddresses, ['leon@example.com']);
  assert.deepEqual(input.Destination.ToAddresses, [CONTACT_EMAIL]);
  assert.equal(input.Content.Simple.Subject.Data, bodies.subject);
  assert.equal(input.Content.Simple.Body.Text.Data, bodies.text);
  assert.equal(input.Content.Simple.Body.Html.Data, bodies.html);
  // No configuration set: the SES/SNS pipeline a configuration set feeds is
  // reconciled against newsletter subscribers, and this is not subscriber mail.
  assert.equal(input.ConfigurationSetName, undefined);

  // A missing region is a configuration failure, not a silent no-op.
  const originalRegion = process.env.AWS_REGION;
  try {
    delete process.env.AWS_REGION;
    await assert.rejects(() => sendContactNotification(note), /AWS region/);
  } finally {
    if (originalRegion === undefined) delete process.env.AWS_REGION;
    else process.env.AWS_REGION = originalRegion;
  }
}

async function testContactLinCheck() {
  // Both halves of the handoff configuration are required.
  assert.equal(linCheckConfig({}), null);
  assert.equal(
    linCheckConfig({ LIN_CHECK_INBOUND_URL: 'https://lin.example/inbound' }),
    null,
  );
  assert.equal(linCheckConfig({ LIN_CHECK_INBOUND_TOKEN: 'token' }), null);
  assert.equal(linCheckConfig({ LIN_CHECK_INBOUND_URL: '   ' }), null);
  // The handoff carries a bearer token, so a non-https endpoint counts as
  // unconfigured instead of putting the token on the wire in clear text.
  for (const endpoint of [
    'http://lin.example/inbound',
    'file:///etc/passwd',
    'not a url',
  ])
    assert.equal(
      linCheckConfig({
        LIN_CHECK_INBOUND_URL: endpoint,
        LIN_CHECK_INBOUND_TOKEN: 'token',
      }),
      null,
      `${endpoint} must not be used as the handoff endpoint`,
    );
  assert.deepEqual(
    linCheckConfig({
      LIN_CHECK_INBOUND_URL: ' https://lin.example/inbound ',
      LIN_CHECK_INBOUND_TOKEN: ' token ',
    }),
    { endpoint: 'https://lin.example/inbound', token: 'token' },
  );

  // An unconfigured handoff changes nothing about the note, so nothing else
  // reports it: the first note that could have been handed off says so once.
  const warnings = await withCapturedLogs(async () => {
    warnIfLinCheckUnconfigured();
    warnIfLinCheckUnconfigured();
  });
  assert.equal(
    warnings.length,
    1,
    'the unconfigured handoff is reported once per process',
  );
  assert.match(String(warnings[0][0]), /LIN_CHECK_INBOUND_URL/);

  const note = {
    id: CONTACT_ID,
    name: 'Leon Lin',
    email: 'leon@example.com',
    message: 'Hello',
    sourcePage: '/now',
    receivedAt: '2026-09-17T10:00:00.000Z',
  };

  // The payload is the whole contract: an inbound note and nothing about who the
  // sender might be. No Person, no Organization, no relationship, no verdict.
  const payload = linCheckPayload(note);
  assert.deepEqual(Object.keys(payload).sort(), [
    'email',
    'id',
    'kind',
    'message',
    'name',
    'receivedAt',
    'sourcePage',
  ]);
  assert.equal(payload.kind, 'website_note');

  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const respond = (status: number) =>
    ((url: string, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return Promise.resolve(new Response('', { status }));
    }) as unknown as typeof fetch;
  const env = {
    LIN_CHECK_INBOUND_URL: 'https://lin.example/inbound',
    LIN_CHECK_INBOUND_TOKEN: 'lin-check-token',
  };

  assert.equal(
    await handOffToLinCheck(note, { env, fetchImpl: respond(201) }),
    'sent',
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, 'https://lin.example/inbound');
  assert.equal(calls[0]?.init?.method, 'POST');
  const headers = calls[0]?.init?.headers as Record<string, string>;
  assert.equal(headers['content-type'], 'application/json');
  assert.equal(headers.authorization, `Bearer ${env.LIN_CHECK_INBOUND_TOKEN}`);
  // The stored submission id is the idempotency key, so a repeated handoff of the
  // same note cannot create a second inbound item.
  assert.equal(headers['idempotency-key'], CONTACT_ID);
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), payload);

  // A refusal from Lin Check, or a handoff that never answers, is a failure to
  // report and not a reason to lose the note: nothing is retried here.
  assert.equal(
    await handOffToLinCheck(note, { env, fetchImpl: respond(500) }),
    'failed',
  );
  assert.equal(
    await handOffToLinCheck(note, {
      env,
      fetchImpl: (async () => {
        throw new Error('offline');
      }) as unknown as typeof fetch,
    }),
    'failed',
  );
  // Nothing is attempted when the handoff is not configured.
  assert.equal(
    await handOffToLinCheck(note, { env: {}, fetchImpl: forbiddenFetch }),
    'unconfigured',
  );

  // A handoff that never answers is abandoned like any other failure. The
  // keep-alive timer is required because Node's `AbortSignal.timeout` timer is
  // unref'd: without another handle the process would exit instead of firing the
  // abort.
  const hanging = (async (_url: string, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () =>
        reject(new Error('lin check request timed out')),
      );
    })) as unknown as typeof fetch;
  const keepAlive = setTimeout(() => {}, 200);
  const startedAt = Date.now();
  try {
    assert.equal(
      await handOffToLinCheck(note, { env, fetchImpl: hanging, timeoutMs: 10 }),
      'failed',
    );
    assert.ok(
      Date.now() - startedAt < LIN_CHECK_TIMEOUT_MS,
      'the shortened timeout ends the wait, not the ten-second default',
    );
  } finally {
    clearTimeout(keepAlive);
  }
}

async function testContactHandlers() {
  const jsonOf = async (response: Response) =>
    (await response.json()) as Record<string, unknown>;
  const captured: unknown[][] = [];

  // The handoff is not configured in these environments, and it reports that once
  // per process, so pin the state here rather than relying on suite order.
  await withCapturedLogs(async () => {
    warnIfLinCheckUnconfigured();
  });

  // --- the note that works ---------------------------------------------------
  const happy = contactDbStub();
  const notified: ContactNotification[] = [];
  const success = await postContactNote(
    {
      name: ' Leon  Lin ',
      email: 'leon@example.com',
      message: 'Hello\r\nworld',
      note_origin: '',
      turnstileToken: 'token',
    },
    contactDeps({
      db: happy.db,
      notify: async (note) => {
        notified.push(note);
      },
    }),
    { referer: 'https://leonlins.com/now?utm_source=newsletter' },
  );
  assert.equal(success.status, 200);
  assert.equal(success.headers.get('cache-control'), 'no-store');
  assert.equal(
    success.headers.get('content-type'),
    'application/json; charset=utf-8',
  );
  const successBody = await jsonOf(success);
  assert.deepEqual(successBody, {
    ok: true,
    message: CONTACT_SUCCESS_MESSAGE,
  });

  // Stored first, then notified: the row is the durable record of what someone
  // wrote, and it is written with the validated, normalized values.
  assert.equal(happy.queries.length, 2);
  const insert = soleQuery(happy.queries, /INSERT INTO contact_submissions/);
  assert.deepEqual(insert.values, [
    'Leon Lin',
    'leon@example.com',
    'Hello\nworld',
    '/now',
  ]);
  assert.deepEqual(notified, [
    {
      id: CONTACT_ID,
      name: 'Leon Lin',
      email: 'leon@example.com',
      message: 'Hello\nworld',
      sourcePage: '/now',
      receivedAt: '2026-09-17T10:00:00.000Z',
    },
  ]);
  // Delivery bookkeeping is a separate write, after the mail was accepted, and it
  // only ever touches this one row.
  const marked = soleQuery(happy.queries, /UPDATE contact_submissions/);
  assert.deepEqual(marked.values, [CONTACT_ID]);
  assert.match(marked.text, /SET notified_at = now\(\)/);
  assert.match(marked.text, /notified_at IS NULL/);

  // --- the page a note came from --------------------------------------------
  for (const [headers, expected] of [
    [{ referer: 'https://leonlins.com/now' }, '/now'],
    [
      { referer: 'https://leonlins.com/writing/a-post/?utm_source=x' },
      '/writing/a-post/',
    ],
    [{ referer: 'https://elsewhere.example/now' }, UNKNOWN_SOURCE_PAGE],
    [{ referer: 'not a url' }, UNKNOWN_SOURCE_PAGE],
    [{}, UNKNOWN_SOURCE_PAGE],
  ] as Array<[Record<string, string>, string]>) {
    const db = contactDbStub();
    const response = await postContactNote(
      CONTACT_NOTE,
      contactDeps({ db: db.db }),
      headers,
    );
    assert.equal(response.status, 200);
    assert.equal(
      soleQuery(db.queries, /INSERT INTO contact_submissions/).values[3],
      expected,
      `referer ${headers.referer ?? '(none)'}`,
    );
  }

  // The source page is never taken from the request body.
  const spoofed = contactDbStub();
  await postContactNote(
    { ...CONTACT_NOTE, sourcePage: 'https://attacker.example/funnel' },
    contactDeps({ db: spoofed.db }),
  );
  assert.equal(
    soleQuery(spoofed.queries, /INSERT INTO contact_submissions/).values[3],
    UNKNOWN_SOURCE_PAGE,
  );

  // --- nothing is stored for a bot ------------------------------------------
  let honeypotNotified = 0;
  const honeypot = await postContactNote(
    { ...CONTACT_NOTE, note_origin: 'http://spam.example', name: 'Bot' },
    contactDeps({
      db: makeForbiddenDb().db,
      notify: async () => {
        honeypotNotified += 1;
      },
    }),
  );
  assert.deepEqual(
    await jsonOf(honeypot),
    successBody,
    'a filled honeypot gets the same answer as a person, and stores nothing',
  );
  assert.equal(honeypotNotified, 0);

  // --- verification ----------------------------------------------------------
  captured.push(
    await withCapturedLogs(async () => {
      const response = await postContactNote(
        CONTACT_NOTE,
        contactDeps({
          db: makeForbiddenDb().db,
          turnstileSecret: '',
          fetchImpl: forbiddenFetch,
        }),
      );
      assert.equal(response.status, 503);
      assert.equal((await jsonOf(response)).error, 'unavailable');
    }),
  );
  assert.deepEqual(captured[0], [
    ['contact_refused', { reason: 'turnstile_unconfigured' }],
  ]);

  captured.push(
    await withCapturedLogs(async () => {
      const response = await postContactNote(
        CONTACT_NOTE,
        contactDeps({
          db: makeForbiddenDb().db,
          fetchImpl: (async () =>
            new Response('', { status: 500 })) as unknown as typeof fetch,
        }),
      );
      assert.equal(response.status, 503);
    }),
  );
  assert.deepEqual(captured[1], [
    ['contact_refused', { reason: 'turnstile_unavailable' }],
  ]);

  captured.push(
    await withCapturedLogs(async () => {
      for (const payload of [
        // A missing token never reaches Cloudflare.
        { ...CONTACT_NOTE, turnstileToken: '' },
        CONTACT_NOTE,
      ]) {
        const response = await postContactNote(
          payload,
          contactDeps({
            db: makeForbiddenDb().db,
            // Cloudflare answers, but it does not accept the token.
            fetchImpl: contactFetch(
              forbiddenFetch,
              async () =>
                new Response(JSON.stringify({ success: false }), {
                  status: 200,
                }),
            ),
          }),
        );
        assert.equal(response.status, 400);
        assert.deepEqual(await jsonOf(response), {
          ok: false,
          error: 'verification_failed',
          message: contactErrors.verification_failed.message,
          field: null,
        });
      }
    }),
  );
  assert.deepEqual(captured[2], [
    ['contact_refused', { reason: 'turnstile_invalid' }],
    ['contact_refused', { reason: 'turnstile_invalid' }],
  ]);

  // A Turnstile token can only be redeemed once, so a repeated submit is refused
  // instead of storing the note a second time.
  let verifications = 0;
  const singleUseFetch = contactFetch(forbiddenFetch, async () => {
    verifications += 1;
    return new Response(JSON.stringify({ success: verifications === 1 }), {
      status: 200,
    });
  });
  captured.push(
    await withCapturedLogs(async () => {
      const db = contactDbStub();
      const deps = contactDeps({ db: db.db, fetchImpl: singleUseFetch });
      assert.equal((await postContactNote(CONTACT_NOTE, deps)).status, 200);
      assert.equal((await postContactNote(CONTACT_NOTE, deps)).status, 400);
      assert.equal(
        db.queries.filter((query) =>
          /INSERT INTO contact_submissions/.test(query.text),
        ).length,
        1,
        'a repeated submit stores the note once',
      );
    }),
  );
  assert.deepEqual(captured[3], [
    ['contact_refused', { reason: 'turnstile_invalid' }],
  ]);

  // --- the request itself ----------------------------------------------------
  const crossSite = await postContactNote(CONTACT_NOTE, contactDeps(), {
    origin: 'https://evil.example',
  });
  assert.equal(crossSite.status, 403);
  assert.deepEqual(await jsonOf(crossSite), {
    ok: false,
    error: 'cross_site',
    message: contactErrors.cross_site.message,
    field: null,
  });
  // A 403 nobody can see is indistinguishable from a reader's mistake, so the
  // one refusal a preview deployment or a mistyped origin produces is logged.
  assert.deepEqual(
    await withCapturedLogs(async () => {
      await postContactNote(CONTACT_NOTE, contactDeps(), {
        origin: 'https://evil.example',
      });
    }),
    [['contact_refused', { reason: 'cross_site' }]],
  );

  captured.push(
    await withCapturedLogs(async () => {
      const post = (body: string | undefined) =>
        handleContactNote(
          new Request(CONTACT_URL, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              origin: 'https://leonlins.com',
            },
            ...(body === undefined ? {} : { body }),
          }),
          contactDeps({ db: makeForbiddenDb().db }),
        );
      for (const [body, expected] of [
        [undefined, 'invalid_request'],
        ['', 'invalid_request'],
        ['not json', 'invalid_request'],
        ['[]', 'invalid_request'],
        ['"a string"', 'invalid_request'],
        [
          JSON.stringify({
            message: 'a'.repeat(MAX_CONTACT_REQUEST_BYTES + 1),
          }),
          'too_large',
        ],
      ] as Array<[string | undefined, string]>) {
        const response = await post(body);
        assert.equal(
          (await jsonOf(response)).error,
          expected,
          `body ${String(body).slice(0, 20)}`,
        );
      }
    }),
  );
  assert.deepEqual(captured[4], [], 'a malformed request is not a failure');

  // --- a missing database ----------------------------------------------------
  captured.push(
    await withCapturedLogs(async () => {
      const response = await postContactNote(
        CONTACT_NOTE,
        contactDeps({ db: null, fetchImpl: forbiddenFetch }),
      );
      assert.equal(response.status, 503);
      assert.deepEqual(await jsonOf(response), {
        ok: false,
        error: 'unavailable',
        message: contactErrors.unavailable.message,
        field: null,
      });
    }),
  );
  assert.deepEqual(captured[5], [
    ['contact_refused', { reason: 'db_unconfigured' }],
  ]);

  // --- validation ------------------------------------------------------------
  for (const [payload, code, field] of [
    [
      { name: '  ', email: 'leon@example.com', message: 'hi' },
      'name_required',
      'name',
    ],
    [{ name: 'Leon', email: 'nope', message: 'hi' }, 'email_invalid', 'email'],
    [
      { name: 'Leon', email: 'leon@example.com', message: ' ' },
      'message_required',
      'message',
    ],
  ] as Array<[Record<string, unknown>, keyof typeof contactErrors, string]>) {
    const response = await postContactNote(
      { ...CONTACT_NOTE, ...payload },
      contactDeps({ db: makeForbiddenDb().db }),
    );
    assert.equal(response.status, 400);
    assert.deepEqual(await jsonOf(response), {
      ok: false,
      error: code,
      message: contactErrors[code].message,
      field,
    });
  }

  // --- the note that could not be stored ------------------------------------
  captured.push(
    await withCapturedLogs(async () => {
      let notifiedCount = 0;
      const response = await postContactNote(
        CONTACT_NOTE,
        contactDeps({
          db: makeFakeDb(() => {
            throw new Error(`insert failed for ${CONTACT_NOTE.email}`);
          }).db,
          notify: async () => {
            notifiedCount += 1;
          },
        }),
      );
      assert.equal(response.status, 503);
      assert.deepEqual(await jsonOf(response), {
        ok: false,
        error: 'unavailable',
        message: contactErrors.unavailable.message,
        field: null,
      });
      assert.equal(notifiedCount, 0, 'an unstored note is never announced');
    }),
  );
  assert.deepEqual(captured[6], [
    ['contact_alert', { kind: 'submission_store_failure', errorName: 'Error' }],
  ]);

  // --- the note that could not be delivered ---------------------------------
  captured.push(
    await withCapturedLogs(async () => {
      const db = contactDbStub();
      const response = await postContactNote(
        CONTACT_NOTE,
        contactDeps({
          db: db.db,
          notify: async () => {
            throw new Error(`SES rejected ${CONTACT_NOTE.email}`);
          },
        }),
      );
      assert.equal(response.status, 503);
      assert.deepEqual(await jsonOf(response), {
        ok: false,
        error: 'delivery_failed',
        message: contactErrors.delivery_failed.message,
        field: null,
      });
      // The row stays unfinished, so the note is still findable and answerable by
      // hand, and the handoff is not attempted for a note that did not go out.
      assert.equal(db.queries.length, 1);
      assert.match(
        db.queries[0]?.text ?? '',
        /INSERT INTO contact_submissions/,
      );
    }),
  );
  assert.deepEqual(captured[7], [
    ['contact_alert', { kind: 'notification_failure', errorName: 'Error' }],
  ]);

  // The real notification path is SES, and a missing region fails visibly rather
  // than quietly dropping the note.
  const originalRegion = process.env.AWS_REGION;
  try {
    delete process.env.AWS_REGION;
    captured.push(
      await withCapturedLogs(async () => {
        const db = contactDbStub();
        const response = await postContactNote(
          CONTACT_NOTE,
          contactDeps({ db: db.db, notify: undefined }),
        );
        assert.equal(response.status, 503);
        assert.equal(db.queries.length, 1);
      }),
    );
  } finally {
    if (originalRegion === undefined) delete process.env.AWS_REGION;
    else process.env.AWS_REGION = originalRegion;
  }
  assert.deepEqual(captured[8], [
    ['contact_alert', { kind: 'notification_failure', errorName: 'Error' }],
  ]);

  // --- the Lin Check handoff -------------------------------------------------
  const linEnv = {
    LIN_CHECK_INBOUND_URL: 'https://lin.example/inbound',
    LIN_CHECK_INBOUND_TOKEN: 'lin-check-token',
  };
  const synced = contactDbStub();
  const handoffCalls: string[] = [];
  const handoff = await postContactNote(
    CONTACT_NOTE,
    contactDeps({
      db: synced.db,
      env: linEnv,
      fetchImpl: contactFetch(async (url) => {
        handoffCalls.push(url);
        return new Response('', { status: 202 });
      }),
    }),
  );
  assert.equal(handoff.status, 200);
  assert.equal(handoffCalls.length, 1);
  // Two separate writes, in order: the note is recorded as delivered, and only
  // then is the handoff recorded. A delivered note is never left looking like
  // one nobody received.
  assert.deepEqual(
    synced.queries
      .filter((query) => /UPDATE contact_submissions/.test(query.text))
      .map((query) => query.text.includes('lin_check_synced_at')),
    [false, true],
    'the delivery record is written before the handoff is recorded',
  );

  const unsynced = contactDbStub();
  captured.push(
    await withCapturedLogs(async () => {
      const response = await postContactNote(
        CONTACT_NOTE,
        contactDeps({
          db: unsynced.db,
          env: linEnv,
          fetchImpl: contactFetch(async () => {
            throw new Error('lin check is down');
          }),
        }),
      );
      // The note was stored and emailed, so the reader is not asked to retry.
      assert.equal(response.status, 200);
    }),
  );
  assert.deepEqual(captured[9], [
    ['contact_alert', { kind: 'lin_check_failure' }],
  ]);
  // A failed handoff records the delivery and nothing else: the row is
  // unfinished only for the handoff, which the alert line reports.
  assert.deepEqual(
    unsynced.queries
      .filter((query) => /UPDATE contact_submissions/.test(query.text))
      .map((query) => query.text.includes('lin_check_synced_at')),
    [false],
  );

  // --- the delivered note whose bookkeeping failed --------------------------
  captured.push(
    await withCapturedLogs(async () => {
      const db = makeFakeDb((query) => {
        if (/INSERT INTO contact_submissions/.test(query.text))
          return [{ id: CONTACT_ID, created_at: '2026-09-17T10:00:00.000Z' }];
        throw new Error('update failed');
      });
      const response = await postContactNote(
        CONTACT_NOTE,
        contactDeps({ db: db.db }),
      );
      assert.equal(response.status, 200);
    }),
  );
  assert.deepEqual(captured[10], [
    ['contact_alert', { kind: 'delivery_record_failure', errorName: 'Error' }],
  ]);

  // --- nothing about a person reaches a log ---------------------------------
  const alertKinds = new Set<string>();
  for (const calls of captured) {
    const serialized = JSON.stringify(calls);
    for (const secret of [
      CONTACT_NOTE.email,
      CONTACT_NOTE.message,
      CONTACT_NOTE.name,
      CONTACT_ID,
    ])
      assert.ok(
        !serialized.includes(secret),
        `no log may carry ${secret.slice(0, 12)}`,
      );
    for (const call of calls as unknown[][]) {
      if (call[0] === 'contact_alert') {
        const fields = call[1] as { kind: string; errorName?: string };
        assert.deepEqual(Object.keys(fields), [
          'kind',
          ...(fields.errorName === undefined ? [] : ['errorName']),
        ]);
        alertKinds.add(fields.kind);
      } else {
        assert.equal(call[0], 'contact_refused');
        assert.deepEqual(Object.keys(call[1] as object), ['reason']);
      }
    }
  }
  assert.deepEqual(
    [...alertKinds].sort(),
    [...contactAlertKinds].sort(),
    'every alert kind the flow can raise is exercised and documented',
  );

  // --- the request carries no network identifiers ---------------------------
  const withNetworkHeaders = contactDbStub();
  await postContactNote(
    CONTACT_NOTE,
    contactDeps({ db: withNetworkHeaders.db }),
    {
      'x-forwarded-for': '203.0.113.7',
      'cf-connecting-ip': '203.0.113.7',
      'x-real-ip': '203.0.113.7',
      'user-agent': 'curl/8.5.0',
    },
  );
  assert.ok(
    !JSON.stringify(withNetworkHeaders.queries).includes('203.0.113.7'),
    'no IP address is stored with a note',
  );
  assert.ok(!JSON.stringify(withNetworkHeaders.queries).includes('curl/8.5.0'));
}

async function testContactStoreSql() {
  const insert = contactDbStub();
  const stored = await createContactSubmission(insert.db, {
    name: 'Leon Lin',
    email: 'leon@example.com',
    message: 'Hello',
    sourcePage: '/now',
  });
  assert.deepEqual(stored, {
    id: CONTACT_ID,
    createdAt: '2026-09-17T10:00:00.000Z',
  });
  assert.equal(insert.queries.length, 1);
  assert.match(
    insert.queries[0]?.text ?? '',
    /INSERT INTO contact_submissions \(name, email, message, source_page\)/,
  );
  assert.match(insert.queries[0]?.text ?? '', /RETURNING id, created_at/);
  assert.deepEqual(insert.queries[0]?.values, [
    'Leon Lin',
    'leon@example.com',
    'Hello',
    '/now',
  ]);
  // The insert is the note and nothing else: delivery state is written later, so
  // an unfinished row stays findable.
  assert.ok(
    !/notified_at|lin_check_synced_at/.test(insert.queries[0]?.text ?? ''),
  );

  // Timestamps are either ISO or empty, never a plausible-looking substitute for
  // a value the database did not return in a usable shape.
  const unparseable = makeFakeDb(() => [
    { id: CONTACT_ID, created_at: 'not a timestamp' },
  ]);
  assert.equal(
    (
      await createContactSubmission(unparseable.db, {
        name: 'Leon Lin',
        email: 'leon@example.com',
        message: 'Hello',
        sourcePage: '/now',
      })
    ).createdAt,
    '',
  );

  // A note the database did not store is an error, not a silent success.
  await assert.rejects(
    () =>
      createContactSubmission(makeFakeDb(() => []).db, {
        name: 'Leon',
        email: 'leon@example.com',
        message: 'Hello',
        sourcePage: '/now',
      }),
    /not stored/,
  );

  // Delivery state is written in two steps: the notification timestamp first, so
  // a delivered note can never be left looking like a note nobody was told about,
  // and the handoff timestamp only when a handoff actually happened.
  const update = makeFakeDb(() => []);
  await markContactNotified(update.db, CONTACT_ID);
  await markContactLinCheckSynced(update.db, CONTACT_ID);
  assert.equal(update.queries.length, 2);
  assert.match(update.queries[0]?.text ?? '', /UPDATE contact_submissions/);
  assert.match(update.queries[0]?.text ?? '', /SET notified_at = now\(\)/);
  assert.match(
    update.queries[0]?.text ?? '',
    /WHERE id =\s+\{\?\}\s+::uuid AND notified_at IS NULL/,
  );
  assert.deepEqual(update.queries[0]?.values, [CONTACT_ID]);
  assert.match(update.queries[1]?.text ?? '', /UPDATE contact_submissions/);
  assert.match(
    update.queries[1]?.text ?? '',
    /SET lin_check_synced_at = now\(\)/,
  );
  assert.match(
    update.queries[1]?.text ?? '',
    /WHERE id =\s+\{\?\}\s+::uuid AND lin_check_synced_at IS NULL/,
  );
  assert.deepEqual(update.queries[1]?.values, [CONTACT_ID]);
  // Neither statement can overwrite a timestamp that is already set, so a
  // retried request cannot rewrite when a note was delivered.
  assert.ok(
    !/notified_at\s*=\s*now\(\),\s*lin_check/.test(
      update.queries[0]?.text ?? '',
    ),
  );
}

function testContactIntegrationBoundaries() {
  const read = (relativePath: string) =>
    fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf-8');
  const component = read('src/components/ContactNote.astro');

  // Every invitation uses the one component, and no page defines its own form.
  for (const page of ['about', 'now', 'contact']) {
    const source = read(`src/pages/${page}.astro`);
    assert.match(
      source,
      /import ContactNote from '\.\.\/components\/ContactNote\.astro'/,
      `${page} must reuse the shared contact component`,
    );
    assert.match(source, /<ContactNote/);
    assert.ok(
      !/<form/.test(source),
      `${page} must not define a second contact form`,
    );
    // The invitation must not hydrate: these pages stay static.
    assert.ok(!/client:(load|visible|idle|media|only)/.test(source));
  }
  // The dedicated page opens the form directly; the in-page invitation is
  // progressive and starts collapsed.
  assert.match(read('src/pages/contact.astro'), /<ContactNote expanded \/>/);
  assert.equal(
    read('src/pages/now.astro').match(/<ContactNote \/>/g)?.length,
    1,
  );
  assert.match(component, /hidden=\{!expanded\}/);
  assert.match(component, /aria-expanded=\{expanded \? 'true' : 'false'\}/);
  assert.match(component, /aria-controls=\{formId\}/);
  // The island script addresses the markup by id, and a mismatch leaves a
  // button that does nothing, so the two are resolved and compared.
  const formId = component.match(/const formId = '([^']+)'/)?.[1] ?? '';
  const toggleSuffix = component.match(
    /const toggleId = `\$\{formId\}([^`]*)`/,
  )?.[1];
  assert.ok(
    formId !== '' && toggleSuffix !== undefined,
    'the ids must stay composed from one base',
  );
  assert.match(component, /id=\{formId\}/);
  assert.match(component, /id=\{toggleId\}/);
  assert.match(
    component,
    new RegExp(`document\\.getElementById\\('${formId}'\\)`),
    'the script must find the form the markup renders',
  );
  assert.match(
    component,
    new RegExp(`document\\.getElementById\\('${formId}${toggleSuffix}'\\)`),
    'the script must find the toggle the markup renders',
  );
  // The toggle is worded, not a bare icon, and only the address is offered when
  // no site key is configured.
  assert.match(component, /Send a note/);
  assert.match(component, /Email me at/);

  // Exactly three fields, plus the honeypot, which a person cannot reach.
  assert.equal(component.match(/<input\b|<textarea\b/g)?.length, 4);
  assert.match(component, /name="name"/);
  assert.match(component, /name="email"/);
  assert.match(component, /name="message"/);
  assert.match(component, /name="note_origin"/);
  assert.match(component, /<div class="contact-honeypot" aria-hidden="true">/);
  assert.match(component, /tabindex="-1"/);
  assert.match(component, /autocomplete="off"/);
  // The trap must not be named or labelled with a word browsers autofill: an
  // autofilled honeypot answers a real note with a fake success and loses it.
  assert.ok(
    !/name="(?:website|url|company|organization|address|username)"/.test(
      component,
    ),
    'the honeypot must avoid browser autofill vocabulary',
  );
  // The limits the browser enforces are the limits the server enforces.
  assert.match(component, /maxlength=\{MAX_CONTACT_NAME_LENGTH\}/);
  assert.match(component, /maxlength=\{MAX_CONTACT_EMAIL_LENGTH\}/);
  assert.match(component, /maxlength=\{MAX_CONTACT_MESSAGE_LENGTH\}/);
  assert.ok(
    !/MAX_CONTACT_SOURCE_LENGTH/.test(component),
    'a page reference is not something a person types',
  );

  // The form posts JSON to the endpoint, and the page it was sent from is never
  // something the browser decides.
  assert.match(component, /const ENDPOINT = '\/api\/contact'/);
  assert.ok(
    !/sourcePage/.test(component),
    'the source page is derived server-side from the Referer',
  );
  // Submitting is bounded and repeatable: the button is disabled in flight, the
  // request times out, and the single-use token is reset after every attempt.
  assert.match(component, /if \(submitting\) return;/);
  assert.match(component, /submit\.disabled = true/);
  assert.match(component, /AbortSignal\.timeout\(REQUEST_TIMEOUT_MS\)/);
  // The server's own send has to finish inside the reader's wait, or the reader
  // is told the note may not have arrived while it is still being delivered.
  const clientWaitMs = Number(
    component.match(/REQUEST_TIMEOUT_MS = ([\d_]+)/)?.[1]?.replaceAll('_', ''),
  );
  assert.ok(
    Number.isFinite(clientWaitMs) && NOTIFICATION_TIMEOUT_MS < clientWaitMs,
    'the notification deadline must sit inside the reader’s own wait',
  );
  assert.match(component, /resetVerification\(\)/);
  assert.match(component, /form\.reset\(\)/);
  // The server's message is what the reader sees, so the two never disagree.
  assert.match(component, /contactErrors\.unavailable\.message/);
  assert.match(component, /contactErrors\.verification_required\.message/);
  // A network failure is not a delivery failure: the note may already be stored,
  // so the client must not invite a resend that would store it twice.
  assert.match(component, /contactErrors\.send_unconfirmed\.message/);
  assert.ok(
    !/catch \{[\s\S]*?contactErrors\.unavailable\.message/.test(component),
    'an unanswered request must not be reported as an unavailable form',
  );
  // An expired or failed widget clears its token, so the check is reset rather
  // than leaving the reader waiting for a token that is not coming.
  assert.match(
    component,
    /if \(!token\) \{[\s\S]*?resetVerification\(\);[\s\S]*?return;/,
  );
  // A response whose body cannot be read is still judged by its status: an
  // accepted note must never be reported as a failure.
  assert.match(
    component,
    /: response\.ok\s*\?\s*CONTACT_SUCCESS_MESSAGE\s*:\s*contactErrors\.unavailable\.message/,
  );
  assert.match(component, /role="status"/);
  assert.match(component, /aria-live="polite"/);

  // Turnstile is rendered explicitly, follows the page theme, and its script is
  // only fetched once someone asks for the form. The browser half is shared with
  // the discussion island, so the script URL and the single-load guard are
  // asserted once, against the module both callers use.
  assert.match(component, /data-contact-turnstile/);
  assert.match(component, /theme: pageTheme\(\)/);
  assert.match(
    component,
    /loadTurnstileScript\(renderWidget\);\n\s*fields\.name\.focus\(\);/,
  );
  const turnstileClient = read('src/lib/turnstile-client.ts');
  assert.match(turnstileClient, /render=explicit/);
  assert.match(turnstileClient, /script\.dataset\.turnstileExplicit = 'true'/);
  assert.match(turnstileClient, /'script\[data-turnstile-explicit\]'/);
  // Collapsing must not leave focus inside a form that is no longer rendered.
  assert.match(component, /if \(!next\) \{[\s\S]*?toggle\.focus\(\);/);
  // A missing site key removes the form entirely and says so in the build log,
  // rather than offering a form that can never pass verification.
  assert.match(component, /warnIfSiteKeyMissing\(/);
  assert.match(component, /\[contact\] PUBLIC_TURNSTILE_SITE_KEY/);
  assert.match(component, /siteKey && \(/);
  assert.match(
    component,
    /turnstileSiteKey\(import\.meta\.env\.PUBLIC_TURNSTILE_SITE_KEY\)/,
  );
  // The style has to beat the form's own layout once script reveals it.
  assert.match(component, /\.contact-form\[hidden\] \{[\s\S]*?display: none;/);
  assert.match(component, /CONTACT_EMAIL/);

  // The invitation is not a navigation item, and the dedicated page is not
  // advertised in the chrome.
  for (const file of [
    'src/components/Header.astro',
    'src/components/Footer.astro',
  ])
    assert.ok(
      !/contact/i.test(read(file)),
      `${file} must stay as it is: contact is an invitation, not a navigation item`,
    );

  // One on-demand route, writing through the shared handler and connection helper.
  const route = read('src/pages/api/contact.ts');
  assert.match(route, /export const prerender = false/);
  assert.match(route, /export const POST/);
  assert.ok(!/export const GET/.test(route), 'notes are write-only');
  assert.match(route, /import \{ tryContactDb \}/);
  assert.match(
    route,
    /handleContactNote\(request, \{ db: tryContactDb\(\) \}\)/,
  );

  // A same-origin JSON POST is the only shape the form sends, so the existing
  // middleware gate covers it without a new exemption.
  assert.equal(
    requiresOriginRejection(
      new Request(CONTACT_URL, {
        method: 'POST',
        headers: {
          origin: 'https://leonlins.com',
          'content-type': 'application/json',
        },
      }),
      false,
    ),
    false,
  );

  // One table, whose constraints mirror the limits the code enforces.
  const migration = read('migrations/contact/001_initial.sql');
  assert.equal(
    migration.match(/CREATE TABLE/g)?.length,
    1,
    'the contact flow stays one table',
  );
  for (const fragment of [
    'id UUID PRIMARY KEY DEFAULT gen_random_uuid()',
    'name TEXT NOT NULL',
    'email TEXT NOT NULL',
    'message TEXT NOT NULL',
    "source_page TEXT NOT NULL DEFAULT 'unknown'",
    'created_at TIMESTAMPTZ NOT NULL DEFAULT now()',
    'notified_at TIMESTAMPTZ',
    'lin_check_synced_at TIMESTAMPTZ',
    `char_length(name) BETWEEN 1 AND ${MAX_CONTACT_NAME_LENGTH}`,
    `char_length(email) BETWEEN 3 AND ${MAX_CONTACT_EMAIL_LENGTH}`,
    `char_length(message) BETWEEN 1 AND ${MAX_CONTACT_MESSAGE_LENGTH}`,
    `char_length(source_page) BETWEEN 1 AND ${MAX_CONTACT_SOURCE_LENGTH}`,
  ])
    assert.ok(
      migration.includes(fragment),
      `the migration must keep ${fragment}`,
    );
  assert.equal(
    migration.match(/CREATE (TABLE|INDEX) IF NOT EXISTS/g)?.length,
    2,
    're-running the migration is a no-op instead of an error',
  );
  // The unfinished work an operator has to look at is one indexed query. Only a
  // note that was never delivered is unfinished: a handoff that did not happen is
  // reported by the alert line, not by a second predicate here.
  assert.match(
    migration,
    /ON contact_submissions \(created_at\)[\s\S]*?WHERE notified_at IS NULL;/,
  );
  // A note carries no network identifier and no browser token.
  assert.ok(!/\bip\b|inet|user_agent|token/i.test(migration));

  // The failure vocabulary is closed, and an alert never carries payload fields.
  assert.deepEqual(
    [...contactAlertKinds],
    [
      'submission_store_failure',
      'notification_failure',
      'delivery_record_failure',
      'lin_check_failure',
    ],
  );
  const handlers = read('src/lib/contact/handlers.ts');
  assert.ok(
    !/error\.message/.test(handlers),
    'an error message quotes the data that caused it and never reaches a log',
  );

  // The handoff owns one outbound call and no database of its own.
  const linCheck = read('src/lib/contact/lin-check.ts');
  assert.match(linCheck, /LIN_CHECK_INBOUND_URL/);
  assert.match(linCheck, /LIN_CHECK_INBOUND_TOKEN/);
  assert.match(linCheck, /'idempotency-key': note\.id/);
  assert.ok(
    !/INSERT INTO|UPDATE contact|DELETE FROM/i.test(linCheck),
    'the handoff reports an inbound; it never writes to a database itself',
  );

  // Delivery reuses the newsletter's verified identity and the existing packages,
  // with no new mail provider.
  const packageJson = JSON.parse(read('package.json')) as {
    dependencies: Record<string, string>;
  };
  for (const dependency of [
    '@aws-sdk/client-sesv2',
    '@neondatabase/serverless',
  ])
    assert.ok(
      packageJson.dependencies[dependency],
      `${dependency} must already be a dependency`,
    );

  // The privacy policy says what a note stores and what it does not.
  const privacy = read('src/pages/privacy.astro');
  assert.match(privacy, /notes? sent from the contact form/i);
  assert.match(privacy, /does not store IP addresses,\s+browser tokens/i);
  // Documentation for whoever operates this.
  assert.ok(fs.existsSync(path.join(REPO_ROOT, 'docs/contact.md')));
  const docs = read('docs/contact.md');
  for (const fragment of [
    'contact_submissions',
    'LIN_CHECK_INBOUND_URL',
    'LIN_CHECK_INBOUND_TOKEN',
    'Idempotency-Key',
    'TURNSTILE_SECRET_KEY',
  ])
    assert.ok(
      docs.includes(fragment),
      `docs/contact.md must document ${fragment}`,
    );
  assert.match(read('README.md'), /docs\/contact\.md/);
  assert.match(read('AGENTS.md'), /contact_submissions/);
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
    testNewsletterAttributionNormalization();
    testNewsletterAttributionRequestShape();
    testNewsletterAttributionCapture();
    testNewsletterReportWindow();
    testNewsletterConfirmationBoundary();
    await testNewsletterAlerting();
    await testSesEventIngestionAlerts();
    await testAnalyticsCheckContract();
    testConfirmationEmailContent();
    testConfirmPages();
    await testConfirmRoute();
    await testSubscriptionLifecycleDb();
    await testNewsletterAttributionSignupWrite();
    await testNewsletterAnalyticsReport();
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
    testContactDomain();
    await testContactNotifications();
    await testContactLinCheck();
    await testContactHandlers();
    await testContactStoreSql();
    testContactIntegrationBoundaries();
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
