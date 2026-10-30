import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { renderNewsletterEmail } from '../src/lib/newsletter/render.ts';

// Synthetic chart pixels stay unchanged; only the email's display dimensions change.
const chart = await sharp({
  create: { width: 2000, height: 800, channels: 3, background: '#f0f5fa' },
})
  .png()
  .toBuffer();
const icon = await sharp({
  create: { width: 64, height: 32, channels: 3, background: '#556677' },
})
  .png()
  .toBuffer();
const html = renderNewsletterEmail({
  articleId: '2026_10_31_layout/index.md',
  title: 'Email layout regression',
  markdown:
    '---\ndescription: Inbox preview\ndraft: false\n---\n\nIntro[^one].\n\n![Large chart](./chart.png)\n\n![Small icon](./icon.png)\n\n> Quoted analysis that must remain visible.\n\n' +
    'A paragraph of substantive article text.\n\n'.repeat(30) +
    'Final analysis[^two].\n\n[^one]: First note.\n[^two]: Last note.',
  postalAddress: 'Synthetic test office, 42 Test Lane, Test City 12345',
  unsubscribeUrl:
    'https://leonlins.com/api/newsletter/unsubscribe?token=fixture-not-real',
  privacyUrl: 'https://leonlins.com/privacy',
  resolveLocalImage: (value) =>
    value.includes('chart') ? 'cid:chart' : 'cid:icon',
})
  .html.replace(
    'cid:chart',
    `data:image/png;base64,${chart.toString('base64')}`,
  )
  .replace('cid:icon', `data:image/png;base64,${icon.toString('base64')}`);
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  let networkRequests = 0;
  await page.route(/^https?:/, (route) => {
    networkRequests++;
    return route.abort();
  });
  for (const width of [1000, 640, 360]) {
    await page.setViewportSize({ width, height: 900 });
    await page.setContent(html);
    const dimensions = await page.locator('article img').evaluateAll((images) =>
      images.map((image) => {
        const element = image as HTMLImageElement;
        const box = element.getBoundingClientRect();
        return {
          width: box.width,
          height: box.height,
          natural: element.naturalWidth,
          left: box.left,
          right: box.right,
        };
      }),
    );
    const container = (await page.locator('main').boundingBox())!;
    assert.equal(container.width, Math.min(640, width));
    assert.ok(dimensions[0].width <= 560 && dimensions[0].width <= width - 40);
    assert.equal(dimensions[0].natural, 2000);
    assert.ok(
      Math.abs(dimensions[0].width / dimensions[0].height - 2.5) < 0.01,
    );
    assert.ok(
      Math.abs((dimensions[0].left + dimensions[0].right) / 2 - width / 2) < 1,
    );
    assert.equal(dimensions[1].width, 64, 'small images must not upscale');
    assert.equal(
      await page.locator('main > p a', { hasText: 'Unsubscribe' }).isVisible(),
      true,
    );
    assert.equal(await page.getByRole('note').isVisible(), true);
    await page.locator('footer').scrollIntoViewIfNeeded();
    for (const label of ['Unsubscribe', 'Privacy', 'Read on the web'])
      assert.equal(
        await page
          .locator('footer')
          .getByRole('link', { name: label, exact: true })
          .isVisible(),
        true,
      );
    assert.match(
      await page.locator('footer').innerText(),
      /Synthetic test office/,
    );
    await page.locator('[data-footnote-ref]').last().click();
    assert.ok(
      await page.evaluate(() => {
        const id = location.hash.slice(1);
        return !!id && !!document.getElementById(id);
      }),
      'footnote references resolve to the visible notes',
    );
    assert.equal(
      await page
        .locator('article blockquote, article [hidden], footer [hidden]')
        .count(),
      0,
    );
  }
  assert.equal(networkRequests, 0);
  console.log(
    'PASS: 640px email/560px centered responsive charts; intrinsic ratios and small images retained; notes, postal footer and opt-out controls visible at desktop/mobile widths. No network or email.',
  );
} finally {
  await browser.close();
}
