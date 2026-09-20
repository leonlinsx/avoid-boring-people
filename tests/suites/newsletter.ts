// Newsletter coverage: domain rules, importing, rendering, send safeguards, confirmation, lifecycle, and analytics.

import assert from 'node:assert/strict';
import {
  canAutomaticallyTransition,
  mapSubstackRow,
  normalizeEmail,
} from '../../src/lib/newsletter/domain.ts';
import { hashToken } from '../../src/lib/newsletter/tokens.ts';
import {
  newsletterAlert,
  type NewsletterAlertFields,
} from '../../src/lib/newsletter/alerting.ts';
import {
  hashRateLimitSubject,
  isRateLimitAllowed,
} from '../../src/lib/newsletter/rate-limit.ts';
import {
  GMAIL_CLIP_LIMIT_BYTES,
  NewsletterRenderError,
  renderNewsletterEmail,
} from '../../src/lib/newsletter/render.ts';
import { assertAllowedTestRecipient } from '../../src/lib/newsletter/test-send.ts';
import {
  importTimestamp,
  planSubstackImport,
} from '../../src/lib/newsletter/importer.ts';
import {
  assertRecipientScope,
  assertSesAccountReady,
  productionSendConfig,
  subscriberUnsubscribeToken,
} from '../../src/lib/newsletter/production-send.ts';
import {
  buildConfirmInvalidPage,
  buildConfirmPromptPage,
  buildConfirmSuccessPage,
} from '../../src/lib/newsletter/confirm-pages.ts';
import {
  buildConfirmationEmail,
  canDeliverConfirmation,
  CONFIRMATION_SUBJECT,
  confirmSubscription,
  genericSubscriptionResponse,
  requestSubscription,
  unsubscribe,
} from '../../src/lib/newsletter/subscriptions.ts';
import { recordSesEvent } from '../../src/lib/newsletter/events.ts';
import {
  confirmSnsSubscription,
  parseSnsEnvelope,
  signingString,
  verifySnsEnvelope,
} from '../../src/lib/newsletter/sns.ts';
import {
  ATTRIBUTION_STORAGE_KEY,
  attributionFromRequest,
  attributionPayload,
  firstTouchAttribution,
  isInformativeSource,
  normalizeAttribution,
  readStoredAttribution,
  referrerDomain,
} from '../../src/lib/newsletter/attribution.ts';
import {
  collectNewsletterMetrics,
  DEFAULT_REPORT_WINDOW_DAYS,
  MAX_REPORT_WINDOW_DAYS,
  MIN_SHARE_SAMPLE,
  newsletterCheckExitCode,
  renderNewsletterReport,
  reportAnalyticsCollectionFailure,
  validateReportWindow,
} from '../../src/lib/newsletter/analytics.ts';
import {
  AUTHOR_REPORT_WINDOW_DAYS,
  analyticsReportSesConfig,
  authorReportRecipient,
  newsletterReportEmail,
  parseAnalyticsEmailArgs,
  parseAuthorReportArgs,
} from '../../src/lib/newsletter/analytics-email.ts';
import {
  NEWSLETTER_FROM,
  NEWSLETTER_REPLY_TO,
} from '../../src/lib/newsletter/email.ts';
import { requiresOriginRejection } from '../../src/lib/newsletter/request-origin.ts';
import { createSign, generateKeyPairSync } from 'node:crypto';
import { withCapturedLogs } from '../helpers/harness.ts';

export function testNewsletterDomain() {
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

export function testNewsletterImporter() {
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

export function testNewsletterRenderer() {
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

export function testNewsletterTestSendSafeguard() {
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

export function testNewsletterAuthorReportSafeguards() {
  const allowlist = 'contact@leonlins.com, leon.lin.sx@example.com';
  const env = {
    NEWSLETTER_TEST_RECIPIENTS: allowlist,
    NEWSLETTER_AUTHOR_REPORT_TO: ' Contact@LeonLins.com ',
    AWS_REGION: 'us-east-2',
    SES_CONFIGURATION_SET: 'my-first-configuration-set',
  } as NodeJS.ProcessEnv;

  // The scheduled report has exactly one fixed recipient, and it has to already
  // be on the existing author allowlist.
  assert.equal(authorReportRecipient(env), 'contact@leonlins.com');
  for (const configured of [
    undefined,
    '   ',
    'reader@example.com',
    // A list, or a subscriber-shaped address, is never a report recipient.
    'contact@leonlins.com, reader@example.com',
  ])
    assert.throws(
      () =>
        authorReportRecipient({
          ...env,
          NEWSLETTER_AUTHOR_REPORT_TO: configured,
        }),
      /No email was sent/,
      `recipient ${JSON.stringify(configured)} must be refused`,
    );

  // The scheduled command takes no recipient: an argument is rejected rather
  // than quietly ignored, so it can never be redirected.
  assert.deepEqual(parseAuthorReportArgs([]), { dryRun: false });
  assert.deepEqual(parseAuthorReportArgs(['--dry-run']), { dryRun: true });
  for (const args of [
    ['--to', 'reader@example.com'],
    ['--confirm-send'],
    ['--days', '30'],
    ['--send'],
  ])
    assert.throws(
      () => parseAuthorReportArgs(args),
      /never an argument/,
      `${args.join(' ')} must be refused`,
    );

  // The manual command keeps requiring both the address and the confirmation.
  assert.deepEqual(
    parseAnalyticsEmailArgs(['--to', 'contact@leonlins.com', '--confirm-send']),
    { to: 'contact@leonlins.com', days: DEFAULT_REPORT_WINDOW_DAYS },
  );
  assert.deepEqual(
    parseAnalyticsEmailArgs([
      '--to',
      'contact@leonlins.com',
      '--confirm-send',
      '--days',
      '30',
    ]),
    { to: 'contact@leonlins.com', days: 30 },
  );
  for (const args of [
    ['--to', 'contact@leonlins.com'],
    ['--confirm-send'],
    ['--to', '--confirm-send'],
    ['--to', 'contact@leonlins.com', '--confirm-send', '--days'],
    ['--to', 'contact@leonlins.com', '--confirm-send', '--days', 'abc'],
  ])
    assert.throws(
      () => parseAnalyticsEmailArgs(args),
      /Usage: npm run newsletter:analytics:email|whole number of days/,
      `${args.join(' ')} must be refused`,
    );

  // SES settings are required before a report is sent.
  assert.deepEqual(analyticsReportSesConfig(env), {
    region: 'us-east-2',
    configurationSet: 'my-first-configuration-set',
  });
  assert.throws(
    () => analyticsReportSesConfig({ ...env, AWS_REGION: undefined }),
    /No email was sent/,
  );
  assert.throws(
    () =>
      analyticsReportSesConfig({ ...env, SES_CONFIGURATION_SET: undefined }),
    /No email was sent/,
  );

  // Exactly one recipient, from the newsletter address, carrying the report.
  const command = newsletterReportEmail({
    to: 'contact@leonlins.com',
    days: AUTHOR_REPORT_WINDOW_DAYS,
    report: 'AUDIENCE\n  1 active',
    configurationSet: 'my-first-configuration-set',
  });
  const input = command.input;
  assert.deepEqual(input.Destination?.ToAddresses, ['contact@leonlins.com']);
  assert.equal(input.FromEmailAddress, NEWSLETTER_FROM);
  assert.deepEqual(input.ReplyToAddresses, [NEWSLETTER_REPLY_TO]);
  assert.equal(input.ConfigurationSetName, 'my-first-configuration-set');
  assert.equal(
    input.Content?.Simple?.Subject?.Data,
    'Newsletter analytics — last 30 days',
  );
  assert.equal(
    input.Content?.Simple?.Body?.Text?.Data,
    'AUDIENCE\n  1 active',
    'the rendered report is the body',
  );
  assert.equal(
    JSON.stringify(input).includes('leon.lin.sx@example.com'),
    false,
    'a report never goes to the whole allowlist',
  );
}

export function testNewsletterProductionSendSafeguards() {
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

export function testNewsletterSafetyHelpers() {
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

export function testNewsletterConfirmationBoundary() {
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

export function testConfirmationEmailContent() {
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

export function testConfirmPages() {
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

export async function testConfirmRoute() {
  const original = { ...process.env };
  try {
    delete process.env.DATABASE_URL;
    delete process.env.DATABASE_URL_UNPOOLED;
    const { GET, POST } = await import(
      '../../src/pages/api/newsletter/confirm.ts'
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

export function makeFakeNewsletterDb(
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

export async function testSubscriptionLifecycleDb() {
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

export function fakeAttributionStorage(initial: Record<string, string> = {}) {
  const entries = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
    snapshot: () => Object.fromEntries(entries),
  };
}

export function testNewsletterAttributionNormalization() {
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

export function testNewsletterAttributionRequestShape() {
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

export function testNewsletterAttributionCapture() {
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

export async function testNewsletterAttributionSignupWrite() {
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

export function analyticsFixtureDb(fixture: {
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

export function assertReadOnly(queries: Array<{ text: string }>) {
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

export async function testNewsletterAnalyticsReport() {
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
export function minimalApiContext(request: Request) {
  return { request, url: new URL(request.url) } as any;
}

export function newsletterAlertLogs(calls: unknown[][]) {
  return calls.filter((call) => call[0] === 'newsletter_alert');
}

export async function testNewsletterAlerting() {
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
    const { POST } = await import(
      '../../src/pages/api/newsletter/subscribe.ts'
    );
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
      '../../src/pages/api/newsletter/ses-events.ts'
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

export async function testAnalyticsCheckContract() {
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

export function sesEnvelope(
  event: Record<string, unknown>,
  messageId = 'sns-1',
) {
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

export async function testSesEventIngestionAlerts() {
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

export function testNewsletterReportWindow() {
  assert.equal(validateReportWindow(1), 1);
  assert.equal(
    validateReportWindow(MAX_REPORT_WINDOW_DAYS),
    MAX_REPORT_WINDOW_DAYS,
  );
  for (const days of [0, -1, 1.5, MAX_REPORT_WINDOW_DAYS + 1, Number.NaN])
    assert.throws(() => validateReportWindow(days));
}

export async function testSnsValidation() {
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

export async function runNewsletterTests() {
  await testNewsletterDomain();
  await testNewsletterImporter();
  await testNewsletterRenderer();
  await testNewsletterTestSendSafeguard();
  await testNewsletterAuthorReportSafeguards();
  await testNewsletterProductionSendSafeguards();
  await testNewsletterSafetyHelpers();
  await testNewsletterAttributionNormalization();
  await testNewsletterAttributionRequestShape();
  await testNewsletterAttributionCapture();
  await testNewsletterReportWindow();
  await testNewsletterConfirmationBoundary();
  await testNewsletterAlerting();
  await testSesEventIngestionAlerts();
  await testAnalyticsCheckContract();
  await testConfirmationEmailContent();
  await testConfirmPages();
  await testConfirmRoute();
  await testSubscriptionLifecycleDb();
  await testNewsletterAttributionSignupWrite();
  await testNewsletterAnalyticsReport();
  await testSnsValidation();
}
