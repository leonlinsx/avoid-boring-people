import assert from 'node:assert/strict';
import { __setMockGetCollectionImplementation } from 'astro:content';
import { computeCleanSlug } from '../src/utils/slug-helpers.ts';
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
import { hashRateLimitSubject, isRateLimitAllowed } from '../src/lib/newsletter/rate-limit.ts';
import { GMAIL_CLIP_LIMIT_BYTES, NewsletterRenderError, renderNewsletterEmail } from '../src/lib/newsletter/render.ts';
import { assertAllowedTestRecipient } from '../src/lib/newsletter/test-send.ts';
import { importTimestamp, planSubstackImport } from '../src/lib/newsletter/importer.ts';
import {
  assertRecipientScope,
  assertSesAccountReady,
  productionSendConfig,
  subscriberUnsubscribeToken,
} from '../src/lib/newsletter/production-send.ts';
import { buildConfirmInvalidPage, buildConfirmSuccessPage } from '../src/lib/newsletter/confirm-pages.ts';
import { buildConfirmationEmail, canDeliverConfirmation, CONFIRMATION_SUBJECT, confirmSubscription, requestSubscription } from '../src/lib/newsletter/subscriptions.ts';
import { confirmSnsSubscription, parseSnsEnvelope, signingString, verifySnsEnvelope } from '../src/lib/newsletter/sns.ts';
import { requiresOriginRejection } from '../src/lib/newsletter/request-origin.ts';
import { createSign, generateKeyPairSync } from 'node:crypto';

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

  assert.deepEqual(searchPosts(detailedPosts as any, 'venture'), [detailedPosts[0]]);
  assert.deepEqual(searchPosts(detailedPosts as any, 'markets'), [detailedPosts[0]]);
  assert.deepEqual(searchPosts(detailedPosts as any, 'equities'), [detailedPosts[0]]);
  assert.deepEqual(searchPosts(detailedPosts as any, 'digest'), [detailedPosts[1]]);
  assert.deepEqual(
    searchPosts(detailedPosts as any, 'venture capital'),
    [detailedPosts[0]],
  );
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
    computeCleanSlug(
      makeEntry({ id: '2024_02_03_new-idea/index.mdx' }),
    ),
    'new-idea',
  );
  assert.equal(
    computeCleanSlug(
      makeEntry({ data: { slug: '  /custom-slug/ ' } }),
    ),
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
  assert.equal(buildPaginationHref(1, 'finance'), '/writing/category/finance/1');
  assert.equal(
    buildPaginationHref(5, 'markets & money'),
    '/writing/category/markets%20%26%20money/5',
  );
  assert.equal(buildPaginationHref(0, 'finance'), '/writing/category/finance/1');
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
  assert.equal(normalizeCategory('Risk & Decision Making'), 'risk-decision-making');
  assert.equal(normalizeCategory(undefined as any), '');
  assert.equal(categoryLabel('system-design'), 'System Design');
}

function testNewsletterDomain() {
  assert.equal(normalizeEmail('  Reader@Example.COM '), 'reader@example.com');
  assert.equal(normalizeEmail('not-an-email'), null);
  assert.equal(canAutomaticallyTransition('pending', 'active'), true);
  assert.equal(canAutomaticallyTransition('unsubscribed', 'active'), false);
  assert.equal(canAutomaticallyTransition('bounced', 'active'), false);

  assert.equal(mapSubstackRow({ Email: 'author@example.com', Type: 'Author' }), null);
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
    mapSubstackRow({ Email: 'cancelled@example.com', 'Cancel date': '2024-01-01' })?.status,
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
  assert.equal(plan.subscribers.find((subscriber) => subscriber.email === 'duplicate@example.test')?.status, 'unsubscribed');
  assert.equal(plan.subscribers.find((subscriber) => subscriber.email === 'paused@example.test')?.status, 'active');
  assert.equal(importTimestamp('2021-01-01'), '2021-01-01T00:00:00.000Z');
  assert.equal(importTimestamp('not-a-date'), null);
}

function testNewsletterRenderer() {
  const input = {
    articleId: '2021_01_06_nonviolent/index.md',
    title: 'Newsletter test',
    markdown: '---\ntitle: Newsletter test\n---\n\n[Site](/writing/test/)\n\n![Post](./n_1.webp)',
    unsubscribeUrl: 'https://leonlins.com/api/newsletter/unsubscribe?token=preview',
    privacyUrl: 'https://leonlins.com/privacy/',
  };
  const rendered = renderNewsletterEmail(input);
  assert.match(rendered.html, /https:\/\/leonlins\.com\/writing\/test\//);
  assert.match(rendered.html, /https:\/\/leonlins\.com\/newsletter-assets\/2021_01_06_nonviolent\/n_1\.webp/);
  assert.match(rendered.html, /max-width:100%/);
  assert.equal(rendered.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
  assert.match(rendered.text, /Newsletter test/);
  assert.doesNotMatch(rendered.html, /123 Example Street/);
  assert.equal(rendered.headers['List-Unsubscribe'], '<https://leonlins.com/api/newsletter/unsubscribe?token=preview>');
  const external = renderNewsletterEmail({ ...input, markdown: '[External](https://example.com/path)' });
  assert.match(external.html, /href="https:\/\/example\.com\/path"/);
  assert.throws(() => renderNewsletterEmail({ ...input, markdown: '[relative](./private)' }), NewsletterRenderError);
  assert.throws(() => renderNewsletterEmail({ ...input, markdown: '![Missing](./does-not-exist.webp)' }), /does not exist/);
  assert.throws(() => renderNewsletterEmail({ ...input, markdown: '<NewsletterWidget />' }), /MDX/);
  assert.throws(() => renderNewsletterEmail({ ...input, markdown: '![Local](https://localhost/private.png)' }), /public HTTPS/);
  assert.throws(() => renderNewsletterEmail({ ...input, markdown: '<iframe src="https://example.com"></iframe>' }), NewsletterRenderError);
  assert.throws(() => renderNewsletterEmail({ ...input, markdown: 'x'.repeat(GMAIL_CLIP_LIMIT_BYTES) }), /100 KB/);
}

function testNewsletterTestSendSafeguard() {
  assert.equal(
    assertAllowedTestRecipient(' Contact@LeonLins.com ', 'contact@leonlins.com'),
    'contact@leonlins.com',
  );
  assert.throws(
    () => assertAllowedTestRecipient('reader@example.com', 'contact@leonlins.com'),
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
  assert.throws(() => productionSendConfig({ ...env, NEWSLETTER_ENVIRONMENT: 'preview' }), /No email was sent/);
  assert.throws(() => productionSendConfig({ ...env, NEWSLETTER_UNSUBSCRIBE_SECRET: 'short' }), /No email was sent/);
  assert.doesNotThrow(() => assertRecipientScope(25, 25, 250));
  assert.throws(() => assertRecipientScope(25, 26, 250), /No email was sent/);
  assert.throws(() => assertRecipientScope(251, 251, 250), /No email was sent/);
  assert.throws(() => assertSesAccountReady({ productionAccessEnabled: false, sendingEnabled: true }, 1), /production access/);
  assert.throws(() => assertSesAccountReady({ productionAccessEnabled: true, sendingEnabled: true, max24HourSend: 100, sentLast24Hours: 99, maxSendRate: 1 }, 2), /quota/);
  assert.deepEqual(assertSesAccountReady({ productionAccessEnabled: true, sendingEnabled: true, max24HourSend: 100, sentLast24Hours: 1, maxSendRate: 2 }, 2), { delayMs: 500 });
  const first = subscriberUnsubscribeToken('subscriber-id', env.NEWSLETTER_UNSUBSCRIBE_SECRET!);
  assert.equal(first, subscriberUnsubscribeToken('subscriber-id', env.NEWSLETTER_UNSUBSCRIBE_SECRET!));
  assert.notEqual(first, subscriberUnsubscribeToken('other-id', env.NEWSLETTER_UNSUBSCRIBE_SECRET!));
  assert.doesNotMatch(first, /subscriber-id/);
}

function testNewsletterSafetyHelpers() {
  assert.equal(hashToken('confirmation-token'), hashToken('confirmation-token'));
  assert.notEqual(hashToken('confirmation-token'), 'confirmation-token');
  assert.equal(hashRateLimitSubject('reader@example.com'), hashRateLimitSubject('reader@example.com'));
  assert.notEqual(hashRateLimitSubject('reader@example.com'), 'reader@example.com');
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
  assert.equal(CONFIRMATION_SUBJECT, 'Confirm your subscription to Avoid Boring People');
  const url = 'https://leonlins.com/api/newsletter/confirm?token=abc123';
  const { html, text } = buildConfirmationEmail(url);
  assert.match(html, />Confirm my subscription<\/a>/);
  assert.ok(html.includes(`<a href="${url}"`), 'HTML button links directly to the confirmation URL');
  assert.match(text, /whatever else I’m exploring\.\nhttps:\/\/leonlins\.com\/api\/newsletter\/confirm\?token=abc123/);
  for (const body of [html, text]) {
    assert.match(body, /Confirm your subscription/);
    assert.match(body, /Thanks for subscribing to Avoid Boring People\./);
    assert.match(body, /If you didn’t subscribe, you can ignore this email\./);
    assert.match(body, /— Leon/);
    assert.match(body, /leonlins\.com/);
  }
  const hrefs = [...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1]);
  assert.ok(hrefs.length > 0);
  for (const href of hrefs) assert.ok(href.startsWith('https://leonlins.com/'), `unexpected confirmation link target: ${href}`);
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
  assert.ok(success.includes('<a class="cta" href="/writing">'), 'success page links into the archive');
  const invalid = buildConfirmInvalidPage();
  assert.match(invalid, /no longer valid/);
  assert.match(invalid, /work only once/);
  assert.match(invalid, /subscribe again/);
  assert.ok(invalid.includes('<a class="cta" href="/#subscribe">'), 'invalid page links back to signup');
  for (const body of [success, invalid]) {
    assert.match(body, /<!DOCTYPE html>/);
    assert.match(body, /— Leon/);
    assert.match(body, /leonlins\.com/);
    assert.doesNotMatch(body, /token=/);
    assert.doesNotMatch(body, /<script/i);
    assert.doesNotMatch(body, /cadence|weekly|monthly/i);
  }
}

function makeFakeNewsletterDb(handler: (query: { text: string; values: unknown[] }) => unknown[]) {
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
      assert.ok(!query.values.includes('good-token'), 'raw confirmation token must never reach the database');
    }

    // Suppressed subscribers are never reactivated or rewritten by a new request.
    for (const status of ['active', 'unsubscribed', 'bounced', 'complained']) {
      const suppressedDb = makeFakeNewsletterDb((query) => {
        if (query.text.includes('newsletter_rate_limits')) return [{ attempt_count: 1 }];
        if (query.text.includes('SELECT status FROM subscribers')) return [{ status }];
        throw new Error(`unexpected query for ${status} subscriber: ${query.text}`);
      });
      const response = await requestSubscription({ email: 'person@example.com' }, suppressedDb.db);
      assert.deepEqual(response, { ok: true, message: 'If this address can receive this newsletter, check your inbox.' });
      assert.ok(suppressedDb.queries.every((query) => !query.text.includes('INSERT INTO subscribers')), `${status} must not be rewritten`);
    }

    // A new address creates pending with hashed tokens only.
    const newDb = makeFakeNewsletterDb((query) => {
      if (query.text.includes('newsletter_rate_limits')) return [{ attempt_count: 1 }];
      if (query.text.includes('SELECT status FROM subscribers')) return [];
      if (query.text.includes('INSERT INTO subscribers')) {
        assert.match(query.text, /'pending'/);
        return [];
      }
      throw new Error(`unexpected query for new subscriber: ${query.text}`);
    });
    await requestSubscription({ email: 'New@Example.com' }, newDb.db);
    const insert = newDb.queries.find((query) => query.text.includes('INSERT INTO subscribers'));
    assert.ok(insert);
    assert.ok(insert.values.includes('new@example.com'));
    const hashes = insert.values.filter((value) => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value));
    assert.equal(hashes.length, 2);
    assert.notEqual(hashes[0], hashes[1]);
  } finally {
    process.env = original;
  }
}

async function testSnsValidation() {
  for (const path of ['/api/newsletter/subscribe', '/api/subscribe', '/api/newsletter/ses-events/']) {
    for (const type of ['text/plain; charset=UTF-8', 'multipart/form-data', 'application/x-www-form-urlencoded']) {
      const request = new Request(`https://leonlins.com${path}`, { method: 'POST', headers: { 'content-type': type } });
      assert.equal(requiresOriginRejection(request, false), true);
      request.headers.set('origin', 'https://leonlins.com');
      assert.equal(requiresOriginRejection(request, false), false);
    }
  }
  const snsRequest = new Request('https://leonlins.com/api/newsletter/ses-events', { method: 'POST', headers: { 'content-type': 'text/plain' } });
  assert.equal(requiresOriginRejection(snsRequest, false), false);
  const oneClickRequest = new Request('https://leonlins.com/api/newsletter/unsubscribe?token=secret', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'List-Unsubscribe=One-Click' });
  assert.equal(requiresOriginRejection(oneClickRequest, false), false);
  assert.equal(requiresOriginRejection(new Request(oneClickRequest.url, { method: 'PUT', headers: oneClickRequest.headers }), false), true);
  assert.equal(requiresOriginRejection(new Request(snsRequest.url, { method: 'PUT' }), false), true);
  assert.equal(requiresOriginRejection(new Request('https://leonlins.com/api/newsletter/subscribe', { method: 'POST' }), false), true);
  const topic = 'arn:aws:sns:us-east-2:123456789012:newsletter-events';
  const envelope = parseSnsEnvelope({
    Type: 'Notification', MessageId: 'event-1', TopicArn: topic, Message: '{"eventType":"Delivery"}',
    Timestamp: '2026-09-07T00:00:00.000Z', SignatureVersion: '2', Signature: 'placeholder',
    SigningCertURL: 'https://sns.us-east-2.amazonaws.com/SimpleNotificationService-test.pem',
  });
  const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const signer = createSign('RSA-SHA256');
  signer.update(signingString(envelope), 'utf8');
  signer.end();
  envelope.Signature = signer.sign(pair.privateKey, 'base64');
  const publicKey = pair.publicKey.export({ type: 'pkcs1', format: 'pem' }).toString();
  await verifySnsEnvelope(envelope, topic, async () => new Response(publicKey, { status: 200 }));
  await assert.rejects(() => verifySnsEnvelope({ ...envelope, Message: 'tampered' }, topic, async () => new Response(publicKey)), /signature is invalid/);
  const confirmation = { ...envelope, Type: 'SubscriptionConfirmation' as const, Token: 'test-token', SubscribeURL: `https://sns.us-east-2.amazonaws.com/?Action=ConfirmSubscription&TopicArn=${encodeURIComponent(topic)}&Token=test-token` };
  const confirmationSigner = createSign('RSA-SHA256');
  confirmationSigner.update(signingString(confirmation));
  confirmation.Signature = confirmationSigner.sign(pair.privateKey, 'base64');
  await verifySnsEnvelope(confirmation, topic, async () => new Response(publicKey));
  await confirmSnsSubscription(confirmation, topic, async (_url, options) => {
    assert.equal(options?.redirect, 'error');
    assert.ok(options?.signal);
    return new Response(null, { status: 200 });
  });
  await assert.rejects(() => confirmSnsSubscription({ ...confirmation, Token: 'wrong' }, topic), /not for the expected topic/);
  await assert.rejects(() => verifySnsEnvelope({ ...envelope, SigningCertURL: 'https://sns.us-east-2.amazonaws.com:444/SimpleNotificationService-test.pem' }, topic), /not from the expected/);
  const expired = AbortSignal.abort();
  await assert.rejects(() => verifySnsEnvelope(envelope, topic, async (_url, options) => {
    options?.signal?.throwIfAborted();
    return new Response(publicKey);
  }, expired), /abort/i);
  await assert.rejects(() => verifySnsEnvelope(envelope, 'arn:aws:sns:us-east-2:123456789012:other', async () => new Response('')),
    /not expected/);
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
      pages.map((page) => page.props.items.map((post: BlogPost) => post.data.title)),
      [
        ['Second', 'First'],
        ['Third'],
      ],
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
      },
      {
        id: '2024_02_01_second/index.md',
        title: 'Second Title',
        url: '/writing/second/',
        date: '2024-02-01T00:00:00.000Z',
        content: 'Second body text',
        category: 'Markets',
        tags: ['trading'],
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
    testEnrichPost();
    await testGetAllPostsPaginated();
    await testGetCategoryPostsPaginated();
    testNormalizeHeroImageHelper();
    testExtractHeadings();
    await testSearchIndexEndpoint();
    await testApiSearchIndexEndpoint();
    await testRssEndpoint();
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
