// Build disposable drafts and verify actual public output, then remove fixtures.
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';

const entry = '2099_01_01_abp_draft_fixture';
const marker = 'ABP_PRIVATE_DRAFT_SENTINEL';
const directory = `src/content/blog/${entry}`;
const translation = `src/content/i18n/ja/${entry}`;
const output = '/tmp/abp-draft-browser-preview.html';
await mkdir(directory);
await mkdir(translation);
try {
  await writeFile(
    `${directory}/index.md`,
    `---\ntitle: ${marker}\npubDate: 2099-01-01\ncategory: Technology\nfeatured: true\ndraft: false\ntags: [abp-private-draft-tag]\nheroImage: './abp_private_draft_image.png'\n---\n\nPrivate content.\n\n![Private](./abp_private_draft_image.png)`,
  );
  await writeFile(
    `${translation}/index.md`,
    `---\ntitle: ${marker}_JA\nlocale: ja\nsourceSlug: abp_draft_fixture\nsourceHash: fixture\n---\n\n${marker}\n\n![Translated](../../../blog/${entry}/abp_private_draft_image.png)`,
  );
  await writeFile(
    `${directory}/abp_private_draft_image.png`,
    await sharp({
      create: { width: 13, height: 17, channels: 3, background: '#8acd73' },
    })
      .png()
      .toBuffer(),
  );
  const env = {
    ...process.env,
    DATABASE_URL: '',
    DATABASE_URL_UNPOOLED: '',
    NEWSLETTER_CONFIRMATION_DELIVERY_ENABLED: 'false',
    NEWSLETTER_CONFIRMATION_PRODUCTION_ENABLED: 'false',
  };
  let result = spawnSync('npm', ['run', 'build'], {
    encoding: 'utf8',
    env,
    maxBuffer: 10 * 1024 * 1024,
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(
    await readFile('dist/client/writing/abp_draft_fixture/index.html', 'utf8'),
    /ABP_PRIVATE_DRAFT_SENTINEL/,
  );
  assert.match(
    await readFile(
      'dist/client/ja/writing/abp_draft_fixture/index.html',
      'utf8',
    ),
    /ABP_PRIVATE_DRAFT_SENTINEL_JA/,
  );
  // Redraft only the English source. The unchanged translation is cached;
  // neither its page nor images may survive the next build.
  const source = await readFile(`${directory}/index.md`, 'utf8');
  await writeFile(
    `${directory}/index.md`,
    source.replace('draft: false', 'draft: true'),
  );
  result = spawnSync('npm', ['run', 'build'], {
    encoding: 'utf8',
    env,
    maxBuffer: 10 * 1024 * 1024,
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const paths = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else paths.push(path);
    }
  }
  await walk('dist/client');
  await walk('.vercel/output/static');
  for (const path of paths) {
    assert.doesNotMatch(
      path,
      /abp_draft_fixture|abp-private-draft-tag|abp_private_draft_image/,
    );
    if (/\.(html|json|xml)$/.test(path))
      assert.doesNotMatch(
        await readFile(path, 'utf8'),
        /ABP_PRIVATE_DRAFT_SENTINEL|abp-private-draft-tag|abp_private_draft_image/,
      );
  }
  // The same unpublished source must render privately with zero network.
  result = spawnSync(
    'npm',
    ['run', 'newsletter:preview:local', '--', `${entry}/index.md`, output],
    { encoding: 'utf8', env },
  );
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    let networkRequests = 0;
    await page.route(/^https?:/, (route) => {
      networkRequests++;
      return route.abort();
    });
    await page.goto(`file://${output}`);
    assert.equal(await page.locator('h1').innerText(), marker);
    const loaded = await page
      .locator('article img')
      .evaluateAll((images) =>
        images.every((image) => image.complete && image.naturalWidth > 0),
      );
    assert.ok(loaded, 'private local images must actually decode in Chromium');
    assert.equal(networkRequests, 0);
  } finally {
    await browser.close();
  }
  console.log(
    'PASS: drafts absent from built home, articles, localized routes, archive/categories/tags, related links, RSS, sitemap/search and newsletter assets; unpublished local preview images decode with no network/SES/DB.',
  );
} finally {
  await rm(directory, { recursive: true, force: true });
  await rm(translation, { recursive: true, force: true });
  await rm(output, { force: true });
}
