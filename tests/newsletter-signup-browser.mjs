/* global document, window */
// Run against a local Astro dev server. All requests except the local page/assets
// are blocked, and the signup endpoint is always mocked before any submission.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const origin = process.argv[2] ?? 'http://127.0.0.1:4321';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname));
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  let requests = [];
  let mode = 'success';
  let release;
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== new URL(origin).origin) return route.abort();
    if (url.pathname === '/api/newsletter/subscribe') {
      assert.equal(request.method(), 'POST');
      assert.match(request.headers()['content-type'], /application\/json/);
      requests.push(request.postDataJSON());
      if (mode === 'network') return route.abort();
      if (mode === 'pending')
        await new Promise((resolve) => {
          release = resolve;
        });
      return route.fulfill({
        status: mode === 'http' ? 503 : 200,
        contentType: 'application/json',
        body: mode === 'malformed' ? '{bad' : JSON.stringify({ ok: true }),
      });
    }
    // No other API side effects are allowed during this UI test.
    if (url.pathname.startsWith('/api/')) return route.abort();
    return route.continue();
  });
  await page.goto(`${origin}/?utm_source=bluesky&utm_campaign=fixture`);
  const form = page.locator('[data-newsletter-form]').first();
  const email = form.locator('[name=email]');
  const button = form.locator('button[type=submit]');
  const message = page.locator('.subscribe-message').first();
  assert.equal(await form.getAttribute('action'), '/api/newsletter/subscribe');
  await email.fill('invalid');
  await button.click();
  assert.equal(
    requests.length,
    0,
    'native validation prevents invalid requests',
  );
  await email.fill('disposable@example.com');
  mode = 'pending';
  await button.click();
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-newsletter-form]')
        .getAttribute('aria-busy') === 'true',
  );
  await page.waitForTimeout(100);
  assert.equal(await button.isDisabled(), true);
  await form.evaluate((element) =>
    element.dispatchEvent(new Event('submit', { cancelable: true })),
  );
  assert.equal(requests.length, 1, 'duplicate submit is ignored');
  release();
  await message
    .filter({ hasText: 'If a confirmation email arrives' })
    .waitFor();
  assert.equal(await button.isEnabled(), true);
  assert.equal(requests[0].source, 'blog-footer');
  assert.equal(requests[0].website, '');
  assert.equal(requests[0].attribution.utmSource, 'bluesky');
  assert.equal(requests[0].attribution.utmCampaign, 'fixture');
  assert.equal(requests[0].attribution.landingPath, '/');
  assert.doesNotMatch(
    await message.innerText(),
    /sent|delivered|You’re subscribed|✅/,
  );
  for (const failure of ['network', 'http', 'malformed']) {
    mode = failure;
    await button.click();
    await message.filter({ hasText: 'Unable to complete' }).waitFor();
    assert.equal(await button.isEnabled(), true);
    assert.doesNotMatch(await message.innerText(), /email was sent|Thanks/);
  }
  mode = 'success';
  await form.locator('[name=website]').fill('bot', { force: true });
  await button.click();
  await message
    .filter({ hasText: 'If a confirmation email arrives' })
    .waitFor();
  assert.equal(requests.at(-1).website, 'bot');
  await page.goto(`${origin}/writing/2020_04_15_keen`);
  const compactForm = page.locator('[data-newsletter-form]').first();
  // Current public pages use full forms. Exercise the retained compact handler
  // with a DOM fixture using the same rendered component and its compact copy.
  await compactForm.evaluate((form) => {
    form.classList.add('compact');
    form.querySelector('[name=source]').value = 'blog-inline';
  });
  const compactId = await compactForm.getAttribute('id');
  await compactForm.locator('[name=email]').fill('disposable@example.com');
  await compactForm.locator('button[type=submit]').click();
  await page
    .locator(`[id="${compactId}-message"]`)
    .filter({ hasText: 'Use the link if a confirmation email arrives' })
    .waitFor();
  assert.equal(requests.at(-1).source, 'blog-inline');
  assert.equal(
    requests.at(-1).attribution.utmSource,
    'bluesky',
    'first touch survives navigation',
  );
  const ids = await page
    .locator('[data-newsletter-form]')
    .evaluateAll((forms) => forms.map((form) => form.id));
  assert.equal(new Set(ids).size, ids.length, 'form IDs are unique');
  await page.goto(origin);
  // Blocked storage still allows a signup with no fabricated attribution.
  await context.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('blocked');
      },
    });
  });
  await page.reload();
  await email.fill('disposable@example.com');
  await button.click();
  await message
    .filter({ hasText: 'If a confirmation email arrives' })
    .waitFor();
  assert.equal(requests.at(-1).attribution, undefined);
  for (const path of ['/', '/writing/keen', '/ja/writing/keen']) {
    await page.goto(`${origin}${path}`);
    const forms = page.locator('[data-newsletter-form]');
    assert.ok(await forms.count(), `${path} has a signup form`);
    for (const item of await forms.all()) {
      assert.equal(
        await item.getAttribute('action'),
        '/api/newsletter/subscribe',
      );
      assert.equal(await item.isVisible(), true);
    }
  }
  const noJs = await browser.newContext({ javaScriptEnabled: false });
  let noJsPosts = 0;
  await noJs.route('**/*', (route) => {
    const request = route.request();
    if (request.method() !== 'GET') {
      noJsPosts++;
      return route.abort();
    }
    if (new URL(request.url()).origin !== new URL(origin).origin)
      return route.abort();
    return route.continue();
  });
  const noJsPage = await noJs.newPage();
  for (const path of ['/', '/writing/keen', '/ja/writing/keen']) {
    await noJsPage.goto(`${origin}${path}`);
    assert.ok(await noJsPage.locator('[data-newsletter-form]').count());
    assert.equal(
      await noJsPage.locator('[data-newsletter-form]').first().isVisible(),
      false,
    );
    const explanation = noJsPage.locator('noscript p').first();
    assert.equal(await explanation.isVisible(), true);
    assert.match(
      await explanation.innerText(),
      /Please enable JavaScript to subscribe/,
    );
    assert.equal(
      await noJsPage.locator('a[href*="substack.com/subscribe"]').count(),
      0,
    );
  }
  assert.equal(noJsPosts, 0);
  await noJs.close();
  console.log(
    'PASS: real rendered form, validation, attribution, honeypot, duplicate submit, generic copy, HTTP/network/JSON errors, blocked storage; all signup requests mocked, no email',
  );
} finally {
  await browser.close();
}
