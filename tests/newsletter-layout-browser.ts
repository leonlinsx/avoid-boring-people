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
    '---\ntitle: Email layout regression\ndescription: Inbox preview\npubDate: 2026-10-31\ndraft: false\n---\n\nIntro[^one].\n\n![Large chart](./chart.png)\n\n![Small icon](./icon.png)\n\n> Quoted analysis that must remain visible.\n\n' +
    'A paragraph of substantive article text.\n\n'.repeat(30) +
    'Final analysis[^two].\n\n[^one]: First note.\n[^two]: Last note.',
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
      await page.locator('header [data-subtitle]').innerText(),
      'Inbox preview',
    );
    assert.match(
      await page.locator('header').innerText(),
      /Leon Lin · October 31, 2026/,
    );
    assert.equal(await page.locator('[data-subtitle]').count(), 1);
    const headerText = await page.locator('header').innerText();
    assert.ok(!headerText.includes('LEON LIN / AVOID BORING PEOPLE'));
    const webLink = page
      .locator('header')
      .getByRole('link', { name: 'Read online' });
    assert.equal(await webLink.isVisible(), true);
    assert.equal(
      await webLink.getAttribute('href'),
      'https://leonlins.com/writing/layout',
    );
    assert.equal(
      await webLink.evaluate((el) => getComputedStyle(el).fontSize),
      '13px',
    );
    assert.match(
      await webLink.evaluate((el) => el.closest('p')!.textContent),
      /Leon Lin · October 31, 2026.*Read online/,
    );
    if (width >= 640) {
      const linkBox = (await webLink.boundingBox())!;
      const bylineBox = (await page
        .locator('header > p')
        .last()
        .boundingBox())!;
      assert.ok(
        linkBox.y < bylineBox.y + 22,
        'web link shares the byline row on desktop',
      );
    }
    assert.equal(
      await page.locator('header [data-subtitle]').isVisible(),
      true,
    );
    assert.equal(
      await page
        .locator('header h1')
        .evaluate((el) => getComputedStyle(el).fontFamily.includes('Georgia')),
      true,
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      'no page horizontal overflow',
    );
    assert.equal(await page.getByRole('note').isVisible(), true);
    await page.locator('footer').scrollIntoViewIfNeeded();
    for (const label of ['Unsubscribe', 'Privacy'])
      assert.equal(
        await page
          .locator('footer')
          .getByRole('link', { name: label, exact: true })
          .isVisible(),
        true,
      );
    assert.doesNotMatch(
      await page.locator('footer').innerText(),
      /Synthetic test office/,
    );
    assert.equal(
      await page
        .getByRole('region', { name: 'Closing' })
        .getByRole('link', { name: 'Read online' })
        .isVisible(),
      true,
    );
    const closing = page.getByRole('region', { name: 'Closing' });
    const closingLink = closing.getByRole('link', { name: 'Read online' });
    assert.equal(await closing.locator('p').count(), 1);
    assert.match(
      await closingLink.evaluate((el) => el.closest('p')!.textContent),
      /Reply to this email\..*Read online/,
    );
    assert.equal(
      await closingLink.evaluate((el) => getComputedStyle(el).fontSize),
      '16px',
    );
    if (width >= 640) {
      const linkBox = (await closingLink.boundingBox())!;
      const paragraphBox = (await closing.locator('p').boundingBox())!;
      assert.ok(
        linkBox.y < paragraphBox.y + 27,
        'closing link shares the reply row on desktop',
      );
    }
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
    'PASS: 640px email/560px centered responsive charts; intrinsic ratios and small images retained; editorial header, compact notes and addressless opt-out footer visible at desktop/mobile widths. No network or email.',
  );
} finally {
  await browser.close();
}
