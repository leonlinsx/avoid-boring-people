import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { neonConfig } from '@neondatabase/serverless';
import { SESv2Client } from '@aws-sdk/client-sesv2';
import type { APIRoute } from 'astro';
import { POST } from '../../src/pages/api/newsletter/subscribe.ts';
import { genericSubscriptionResponse } from '../../src/lib/newsletter/subscriptions.ts';
import { withCapturedLogs } from '../helpers/harness.ts';

export async function runSignupFormTests() {
  const originalEnv = { ...process.env };
  const originalFetch = neonConfig.fetchFunction;
  const originalSend = SESv2Client.prototype.send;
  const queries: Array<{ query: string; params: string[] }> = [];
  let status: string | undefined;
  let attempts = 1;
  let fail = false;
  let sends = 0;
  try {
    // A syntactically valid disposable URL; every database request is intercepted.
    process.env.DATABASE_URL =
      'postgresql://fixture:fixture@fixture.invalid/fixture';
    process.env.NEWSLETTER_CONFIRMATION_DELIVERY_ENABLED = 'true';
    delete process.env.NEWSLETTER_CONFIRMATION_PRODUCTION_ENABLED;
    process.env.NEWSLETTER_TEST_RECIPIENTS = 'approved@example.com';
    process.env.SES_CONFIGURATION_SET = 'fixture';
    SESv2Client.prototype.send = (async () => {
      sends++;
      throw new Error('SES must not be called for this fixture');
    }) as typeof originalSend;
    neonConfig.fetchFunction = async (
      _url: Parameters<typeof fetch>[0],
      options?: RequestInit,
    ) => {
      const query = JSON.parse(String(options?.body));
      queries.push(query);
      if (fail) throw new Error('fixture database unavailable');
      const rows = query.query.includes('newsletter_rate_limits')
        ? [{ attempt_count: String(attempts) }]
        : query.query.includes('SELECT status')
          ? status
            ? [{ status }]
            : []
          : [{ id: 'disposable' }];
      const names = Object.keys(rows[0] ?? {});
      return Response.json({
        fields: names.map((name) => ({ name, dataTypeID: 25 })),
        rows: rows.map((row) =>
          names.map((name) => row[name as keyof typeof row]),
        ),
        rowCount: rows.length,
      });
    };
    const submit = async (input: unknown) => {
      const response = await POST({
        request: new Request('https://leonlins.com/api/newsletter/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        }),
        clientAddress: '192.0.2.1',
      } as Parameters<APIRoute>[0]);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), genericSubscriptionResponse);
      // Assert outside the API catch so a forbidden query cannot be hidden by
      // its deliberately generic error response.
      for (const query of queries)
        assert.doesNotMatch(query.query, /campaigns|campaign_recipients/i);
    };
    await submit({
      email: 'new-reader@example.com',
      source: 'blog-inline',
      website: '',
      attribution: { utmSource: 'bluesky', landingPath: '/writing/fixture' },
      campaignId: 'must-be-ignored',
    });
    const insert = queries.find((q) =>
      q.query.includes('INSERT INTO subscribers'),
    );
    assert.ok(insert, 'the real API must reach the mocked subscription write');
    for (const value of [
      'new-reader@example.com',
      'blog-inline',
      'bluesky',
      '/writing/fixture',
    ])
      assert.ok(insert.params.includes(value), `API forwards ${value}`);
    assert.equal(sends, 0, 'non-allowlisted confirmation is skipped');
    for (const input of [
      { email: 'bot@example.com', website: 'bot' },
      { email: 'bad' },
      { email: {} },
    ]) {
      queries.length = 0;
      await submit(input);
      assert.equal(queries.length, 0);
    }
    for (const suppressed of ['active', 'bounced', 'complained']) {
      status = suppressed;
      queries.length = 0;
      await submit({ email: 'new-reader@example.com' });
      assert.ok(
        queries.every((q) => !q.query.includes('INSERT INTO subscribers')),
      );
    }
    status = undefined;
    attempts = 21;
    queries.length = 0;
    await submit({ email: 'new-reader@example.com' });
    assert.ok(queries.every((q) => q.query.includes('newsletter_rate_limits')));
    fail = true;
    const logs = await withCapturedLogs(async () => {
      await submit({ email: 'new-reader@example.com' });
    });
    assert.doesNotMatch(JSON.stringify(logs), /new-reader|campaignId/);
    assert.equal(sends, 0);
  } finally {
    neonConfig.fetchFunction = originalFetch;
    SESv2Client.prototype.send = originalSend;
    process.env = originalEnv;
  }
  const form = readFileSync('src/components/SubscribeForm.astro', 'utf8');
  assert.match(form, /type="email"[\s\S]*required/);
  assert.match(form, /autocomplete="email"/);
  assert.match(form, /aria-describedby/);
  assert.match(form, /aria-live="polite"/);
  assert.match(form, /name="website"[\s\S]*tabindex="-1"/);
  assert.match(form, /If a confirmation email arrives/);
  assert.match(form, /Use the link if a confirmation email arrives/);
  // The public signup's server import tree is independent of campaign code.
  for (const path of [
    'src/pages/api/newsletter/subscribe.ts',
    'src/lib/newsletter/subscriptions.ts',
  ])
    assert.doesNotMatch(
      readFileSync(path, 'utf8'),
      /from .*campaign|snapshotCampaign|production-send|send-campaign/,
    );
  console.log(
    '✅ Owned signup API and form safeguards passed (mock DB, zero SES calls)',
  );
}
