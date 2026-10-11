import assert from 'node:assert/strict';
import { readJsonBody } from '../../src/lib/request-body.ts';
import { signupClientIp } from '../../src/lib/newsletter/signup-input.ts';
import {
  assertCampaignContent,
  campaignContentHash,
  newsletterTitle,
  warmupCohortSize,
  snapshotCampaign,
} from '../../src/lib/newsletter/campaign.ts';
import { SESv2Client } from '@aws-sdk/client-sesv2';
import {
  genericSubscriptionResponse,
  requestSubscription,
} from '../../src/lib/newsletter/subscriptions.ts';
import type { APIRoute } from 'astro';
import { makeFakeDb, withCapturedLogs } from '../helpers/harness.ts';

function minimalApiContext(request: Request) {
  return { request, url: new URL(request.url) } as Parameters<APIRoute>[0];
}

export async function testPreMigrationReadiness() {
  const request = new Request('https://leonlins.com/api/newsletter/subscribe', {
    headers: {
      'x-forwarded-for': '203.0.113.99, 203.0.113.1',
      'x-vercel-forwarded-for': '192.0.2.1',
    },
  });
  assert.equal(signupClientIp(request, '192.0.2.2', true), '192.0.2.1');
  assert.equal(signupClientIp(request, '192.0.2.2', false), '192.0.2.2');
  request.headers.set('x-vercel-forwarded-for', '192.0.2.1, 192.0.2.2');
  assert.equal(signupClientIp(request, '192.0.2.2', true), 'unknown');
  request.headers.delete('x-vercel-forwarded-for');
  assert.equal(signupClientIp(request, undefined, true), 'unknown');
  request.headers.set('x-vercel-forwarded-for', '2001:0db8:0:0:0:0:0:1');
  assert.equal(signupClientIp(request, undefined, true), '[2001:db8::1]');

  for (const body of ['null', '[]', '{bad', '"hello"'])
    assert.equal(
      (
        await readJsonBody(
          new Request('https://example.com', { method: 'POST', body }),
          100,
        )
      ).ok,
      false,
    );
  const utf8 = new Request('https://example.com', {
    method: 'POST',
    body: JSON.stringify({ email: '界'.repeat(20) }),
  });
  assert.deepEqual(await readJsonBody(utf8, 50), {
    ok: false,
    error: 'too_large',
  });
  let cancelled = false;
  let chunks = 0;
  const stream = new ReadableStream({
    pull(controller) {
      chunks++;
      controller.enqueue(new Uint8Array(64));
    },
    cancel() {
      cancelled = true;
    },
  });
  const chunked = new Request('https://example.com', {
    method: 'POST',
    body: stream,
    duplex: 'half',
  } as RequestInit);
  assert.deepEqual(await readJsonBody(chunked, 100), {
    ok: false,
    error: 'too_large',
  });
  assert.equal(cancelled, true);
  assert.ok(chunks <= 3, 'oversized streaming body stops being read');

  const markdown = '---\ntitle: "Approved title"\n---\n\nOriginal content.\n';
  const title = newsletterTitle(markdown);
  assert.equal(title, 'Approved title');
  assert.throws(() => newsletterTitle('Body\n\ntitle: fake'), /no title/);
  const hash = campaignContentHash('fixture/index.md', title, markdown);
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.equal(hash, campaignContentHash('fixture/index.md', title, markdown));
  assertCampaignContent(hash, hash);
  for (const expected of [null, undefined, '', 'a'.repeat(64)])
    assert.throws(() => assertCampaignContent(expected, hash));
  for (const actual of [
    campaignContentHash('fixture/index.md', 'Changed title', markdown),
    campaignContentHash('fixture/index.md', title, markdown + 'Changed body.'),
    campaignContentHash(
      'fixture/index.md',
      title,
      markdown,
      'https://leonlins.com/different-privacy',
    ),
  ])
    assert.throws(() => assertCampaignContent(hash, actual));
  assert.equal(warmupCohortSize(undefined, 1000), null);
  for (const size of [200, 250, 300])
    assert.equal(warmupCohortSize(String(size), size), size);
  for (const size of ['199', '301', '250.5', '2e2', '--confirm-snapshot'])
    assert.throws(() => warmupCohortSize(size, Number(size)));
  assert.throws(() => warmupCohortSize('250', 251));
  const fake = makeFakeDb(() => [
    {
      id: 'campaign',
      status: 'draft',
      content_hash: hash,
      recipient_selection: 'recent-subscribers:250',
      recipient_count: 250,
      created: true,
    },
  ]);
  await snapshotCampaign(
    {
      articleId: 'fixture/index.md',
      subject: title,
      contentHash: hash,
      expected: 250,
      maximum: 300,
      cohortSize: 250,
    },
    fake.db,
  );
  assert.match(fake.queries[0].text, /WHERE status = 'active'/);
  assert.match(
    fake.queries[0].text,
    /ORDER BY COALESCE\(original_subscribed_at, confirmed_at, created_at\) DESC, id/,
  );
  assert.match(fake.queries[0].text, /ON CONFLICT \(article_slug\) DO NOTHING/);

  // The status can change between SELECT and INSERT. A guarded no-op must
  // not send an unused confirmation credential to a newly suppressed address.
  const originalSend = SESv2Client.prototype.send;
  const deliveryEnv = { ...process.env };
  let confirmationCalls = 0;
  try {
    process.env.NEWSLETTER_CONFIRMATION_DELIVERY_ENABLED = 'true';
    process.env.NEWSLETTER_CONFIRMATION_PRODUCTION_ENABLED = 'true';
    process.env.SES_CONFIGURATION_SET = 'fixture';
    SESv2Client.prototype.send = (async () => {
      confirmationCalls++;
      throw new Error('sensitive-address@example.com');
    }) as typeof originalSend;
    for (const status of ['pending', 'unsubscribed']) {
      const raced = makeFakeDb((query) => {
        if (query.text.includes('newsletter_rate_limits'))
          return [{ attempt_count: 1 }];
        if (query.text.includes('SELECT status')) return [{ status }];
        return [];
      });
      assert.deepEqual(
        await requestSubscription({ email: 'raced@example.com' }, raced.db),
        genericSubscriptionResponse,
      );
    }
    assert.equal(confirmationCalls, 0);
    const issued = makeFakeDb((query) => {
      if (query.text.includes('newsletter_rate_limits'))
        return [{ attempt_count: 1 }];
      if (query.text.includes('INSERT INTO subscribers'))
        return [{ id: 'fixture' }];
      return [];
    });
    const logs = await withCapturedLogs(async () => {
      await assert.rejects(
        () =>
          requestSubscription(
            { email: 'sensitive-address@example.com' },
            issued.db,
          ),
        /sensitive-address/,
      );
    });
    assert.equal(confirmationCalls, 1);
    assert.doesNotMatch(JSON.stringify(logs), /sensitive-address@example.com/);
  } finally {
    SESv2Client.prototype.send = originalSend;
    process.env = deliveryEnv;
  }

  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;
  try {
    delete process.env.DATABASE_URL;
    delete process.env.DATABASE_URL_UNPOOLED;
    const { POST: ownedPost } =
      await import('../../src/pages/api/newsletter/subscribe.ts');
    const { POST: legacyPost } =
      await import('../../src/pages/api/subscribe.ts');
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      throw new Error('private token fixture@example.com');
    };
    const logs = await withCapturedLogs(async () => {
      for (const input of [
        { email: {} },
        { email: 'a'.repeat(9000) },
        { email: 'valid@example.com', website: { hidden: true } },
      ]) {
        const context = minimalApiContext(
          new Request('https://leonlins.com/api/subscribe', {
            method: 'POST',
            body: JSON.stringify(input),
          }),
        );
        const response = await ownedPost(context);
        assert.deepEqual(await response.json(), genericSubscriptionResponse);
        await legacyPost(
          minimalApiContext(
            new Request('https://leonlins.com/api/subscribe', {
              method: 'POST',
              body: JSON.stringify(input),
            }),
          ),
        );
      }
      assert.equal(calls, 0);
      const response = await legacyPost(
        minimalApiContext(
          new Request('https://leonlins.com/api/subscribe', {
            method: 'POST',
            body: JSON.stringify({ email: 'valid@example.com' }),
          }),
        ),
      );
      assert.equal(response.status, 500);
      assert.doesNotMatch(
        await response.text(),
        /private token|fixture@example.com/,
      );
      assert.equal(calls, 1);
      const forwarded: Array<{ url: string; body: string }> = [];
      globalThis.fetch = async (url, options) => {
        forwarded.push({ url: String(url), body: String(options?.body) });
        return new Response('', { status: forwarded.length === 1 ? 400 : 200 });
      };
      const fallback = await legacyPost(
        minimalApiContext(
          new Request('https://leonlins.com/api/subscribe', {
            method: 'POST',
            body: JSON.stringify({
              email: ' Valid@Example.COM ',
              first_url: 'https://leonlins.com/writing',
              source: { invalid: true },
            }),
          }),
        ),
      );
      assert.equal(fallback.status, 200);
      assert.deepEqual(await fallback.json(), { ok: true });
      assert.equal(forwarded.length, 2);
      assert.ok(
        forwarded.every(
          (item) =>
            item.url === 'https://avoidboringpeople.substack.com/api/v1/free',
        ),
      );
      assert.equal(JSON.parse(forwarded[0].body).email, 'valid@example.com');
      assert.equal(new URLSearchParams(forwarded[1].body).get('source'), null);
      process.env.NEWSLETTER_SNS_TOPIC_ARN =
        'arn:aws:sns:us-east-2:123456789012:fixture';
      const { POST: snsPost } =
        await import('../../src/pages/api/newsletter/ses-events.ts');
      assert.equal(
        (
          await snsPost(
            minimalApiContext(
              new Request('https://leonlins.com/api/newsletter/ses-events', {
                method: 'POST',
                body: 'secret-body-token-this-is-not-json',
              }),
            ),
          )
        ).status,
        400,
      );
    });
    assert.doesNotMatch(
      JSON.stringify(logs),
      /private token|fixture@example.com|secret-body-token/,
    );
  } finally {
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
  }
}
