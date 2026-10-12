// Real browser -> Astro middleware -> confirmation route, with no SES or DB I/O.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const repo = fileURLToPath(new URL('../', import.meta.url));
const fixture = await mkdtemp(join(tmpdir(), 'newsletter-confirm-browser-'));
const canonical = 'https://leonlins.com';
// Oversized invalid token exits before querying the intentionally unreachable DB.
const token = 'synthetic-invalid-'.repeat(20);
let server, browser;
try {
  await mkdir(join(fixture, 'src/pages/api/newsletter'), { recursive: true });
  await mkdir(join(fixture, 'src/pages/api/comments/[slug]'), {
    recursive: true,
  });
  await symlink(join(repo, 'node_modules'), join(fixture, 'node_modules'));
  await writeFile(join(fixture, 'package.json'), '{"type":"module"}');
  await writeFile(
    join(fixture, 'astro.config.mjs'),
    `export default {
    output: 'server', security: { checkOrigin: false },
    server: { host: '127.0.0.1', port: 0 },
    vite: { server: { fs: { allow: [${JSON.stringify(repo)}, ${JSON.stringify(fixture)}] } } }
  };`,
  );
  for (const [target, source, exports] of [
    ['src/middleware.ts', 'src/middleware.ts', 'onRequest'],
    [
      'src/pages/api/newsletter/confirm.ts',
      'src/pages/api/newsletter/confirm.ts',
      'GET, POST, prerender',
    ],
    ['src/pages/api/contact.ts', 'src/pages/api/contact.ts', 'POST, prerender'],
    [
      'src/pages/api/comments/[slug]/index.ts',
      'src/pages/api/comments/[slug]/index.ts',
      'POST, prerender',
    ],
  ]) {
    await writeFile(
      join(fixture, target),
      `export { ${exports} } from ${JSON.stringify(join(repo, source))};\n`,
    );
  }
  // A fresh root has no .env files, and inherited production credentials are omitted.
  server = spawn(
    process.execPath,
    [join(repo, 'node_modules/astro/bin/astro.mjs'), 'dev'],
    {
      cwd: fixture,
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        CI: 'true',
        DATABASE_URL: 'postgresql://fixture:fixture@127.0.0.1:1/fixture',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  const local = await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Local Astro startup timed out')),
      30000,
    );
    server.once('exit', () => {
      clearTimeout(timer);
      reject(new Error('Local Astro exited during startup'));
    });
    server.stdout.on('data', (chunk) => {
      const match = chunk.toString().match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) {
        clearTimeout(timer);
        resolve(match[0]);
      }
    });
    server.stderr.resume();
  });
  browser = await chromium.launch({
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL,
  });
  const context = await browser.newContext({ serviceWorkers: 'block' });
  let formHeaders;
  // Preserve the browser's canonical origin while forwarding every request to
  // local Astro. No request goes to the live site; no response is mocked here.
  await context.route(`${canonical}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'POST') formHeaders = request.headers();
    const response = await route.fetch({
      url: local + url.pathname + url.search,
    });
    await route.fulfill({ response });
  });
  const page = await context.newPage();
  const prompt = await page.goto(
    `${canonical}/api/newsletter/confirm?token=${token}`,
  );
  assert.equal(prompt.status(), 200);
  const [result] = await Promise.all([
    page.waitForNavigation(),
    page
      .getByRole('button', { name: 'Confirm subscription', exact: true })
      .click(),
  ]);
  assert.equal(
    formHeaders.origin,
    canonical,
    'browser form POST must have canonical Origin',
  );
  assert.equal(prompt.headers()['referrer-policy'], 'origin');
  assert.equal(
    formHeaders.referer,
    canonical + '/',
    'Referer must contain only the origin, no path or token',
  );
  assert.equal(result.status(), 200);
  assert.match(
    await page.locator('body').innerText(),
    /This link is no longer valid/,
  );
  assert.equal(result.headers()['referrer-policy'], 'no-referrer');
  console.log(
    'Browser confirmation POST: canonical Origin, origin-only Referer, HTTP 200 invalid-token result',
  );

  // An agent HTTP harness must supply Origin explicitly; it is not a browser.
  for (const [origin, status] of [
    [undefined, 403],
    [canonical, 200],
  ]) {
    const response = await context.request.post(
      local + '/api/newsletter/confirm',
      {
        form: { token },
        headers: origin ? { origin } : {},
      },
    );
    assert.equal(response.status(), status);
  }
  console.log(
    'HTTP harness: omitted Origin rejected (403), canonical Origin accepted (200)',
  );

  // Genuine cross-origin browser forms must remain blocked on unrelated routes.
  await context.route('https://attacker.example/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<html><body><form method="post"><button>Submit</button></form></body></html>',
    }),
  );
  for (const path of ['/api/contact', '/api/comments/fixture']) {
    await page.goto('https://attacker.example/');
    await page.locator('form').evaluate((form, action) => {
      form.action = action;
    }, canonical + path);
    const [response] = await Promise.all([
      page.waitForNavigation(),
      page.getByRole('button', { name: 'Submit' }).click(),
    ]);
    assert.equal(formHeaders.origin, 'https://attacker.example');
    assert.equal(response.status(), 403);
    assert.match(
      await page.locator('body').innerText(),
      /Cross-site POST form submissions are forbidden/,
    );
  }
  console.log(
    'Cross-origin browser forms: contact and comments remain rejected (403)',
  );
} finally {
  await browser?.close();
  if (server && server.exitCode === null) {
    const exited = once(server, 'exit');
    server.kill('SIGTERM');
    await exited;
  }
  await rm(fixture, { recursive: true, force: true });
}
