import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import {
  renderNewsletterEmail,
  GMAIL_CLIP_LIMIT_BYTES,
} from '../../src/lib/newsletter/render.ts';
import {
  newsletterArticleUrl,
  newsletterPreheader,
  newsletterPresentation,
  assertPublishedNewsletterPage,
} from '../../src/lib/newsletter/presentation.ts';
import {
  campaignContentHash,
  assertCampaignContent,
} from '../../src/lib/newsletter/campaign.ts';
import { buildTestEmail } from '../../src/lib/newsletter/test-message.ts';
import {
  productionSendConfig,
  subscriberUnsubscribeToken,
} from '../../src/lib/newsletter/production-send.ts';

const address = 'Synthetic test office, 42 Test Lane, Test City 12345';
const articleId = '2026_10_31_fixture/index.md';
const markdown = `---\ntitle: Fixture edition\ndescription: "A concise & useful inbox snippet"\nslug: ' /custom-fixture/ '\ndraft: false\n---\n\nOpening[^a].\n\n> Substantive quoted argument[^b].\n>\n> A second paragraph with **important details**.\n\nFinal analysis[^a].\n\n[^a]: First footnote with [source](https://example.com/source).\n[^b]: Second footnote.\n`;
const url = 'https://leonlins.com/writing/custom-fixture';
const privacyUrl = 'https://leonlins.com/privacy/';
const unsubscribeUrl =
  'https://leonlins.com/api/newsletter/unsubscribe?token=synthetic-recipient-one';

export async function runNewsletterPresentationTests() {
  const presentation = newsletterPresentation(
    { NEWSLETTER_POSTAL_ADDRESS: address },
    true,
  );
  const rendered = renderNewsletterEmail({
    ...presentation,
    articleId,
    markdown,
    title: 'Fixture edition',
    privacyUrl,
    unsubscribeUrl,
  });
  assert.equal(newsletterArticleUrl(articleId, markdown), url);
  assert.equal(
    newsletterArticleUrl(articleId, '---\ndraft: false\n---\nBody'),
    'https://leonlins.com/writing/fixture',
  );
  assert.equal(
    newsletterArticleUrl(
      articleId,
      markdown.replace('draft: false', 'draft: true'),
    ),
    undefined,
  );
  assert.equal((rendered.html.match(/>Read on the web<\/a>/g) ?? []).length, 2);
  assert.ok(
    rendered.html.indexOf('Read on the web') > rendered.html.indexOf('</h1>'),
  );
  assert.ok(
    rendered.html.indexOf('Read on the web') <
      rendered.html.indexOf('<article>'),
  );
  assert.match(rendered.html, /max-width:640px;box-sizing:border-box/);
  assert.match(
    rendered.html,
    /aria-hidden="true">A concise &amp; useful inbox snippet/,
  );
  assert.equal(
    newsletterPreheader('---\ndescription: "' + 'a'.repeat(200) + '"\n---\n'),
    'a'.repeat(159) + '…',
  );
  assert.equal(newsletterPreheader('Body without a description'), undefined);
  assert.equal(newsletterPreheader('---\ndescription: 123\n---\n'), undefined);
  const noSnippet = renderNewsletterEmail({
    ...presentation,
    preheader: false,
    articleId,
    markdown,
    title: 'Fixture edition',
    privacyUrl,
    unsubscribeUrl,
  });
  assert.doesNotMatch(noSnippet.html, /mso-hide:all/);
  assert.equal(
    newsletterPresentation({ NEWSLETTER_PREHEADER_ENABLED: 'false' }).preheader,
    false,
  );
  const draft = renderNewsletterEmail({
    articleId,
    markdown: markdown.replace('draft: false', 'draft: true'),
    title: 'Draft',
    privacyUrl,
    unsubscribeUrl,
  });
  assert.doesNotMatch(draft.html, /Read on the web/);

  const article = rendered.html.split('<article>')[1].split('</article>')[0];
  for (const substantive of [
    'Substantive quoted argument',
    'A second paragraph',
    'important details',
    'Final analysis',
    'First footnote',
    'Second footnote',
  ])
    assert.ok(article.includes(substantive));
  assert.doesNotMatch(
    article,
    /<blockquote|gmail_quote|display:none|visibility:hidden|<details/,
  );
  assert.match(article, /role="note" aria-label="Quoted passage"/);
  const ids = new Set(
    [...article.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]),
  );
  const targets = [...article.matchAll(/href="#([^"]+)"/g)].map(
    (match) => match[1],
  );
  assert.ok(
    targets.length >= 6,
    'three references plus backreferences survive',
  );
  for (const target of targets)
    assert.ok(ids.has(target), `Missing footnote target ${target}`);
  assert.match(rendered.text, /Opening\[1\]/);
  assert.match(rendered.text, /argument\[2\]/);
  assert.match(rendered.text, /Final analysis\[1\]/);
  assert.match(rendered.text, /Notes:\n\[1\] First footnote/);
  assert.match(rendered.text, /\[2\] Second footnote/);
  const footer = rendered.html.split('<footer')[1];
  for (const content of [
    'Avoid Boring People by Leon Lin',
    address,
    unsubscribeUrl,
    privacyUrl,
  ])
    assert.ok(footer.includes(content));
  assert.equal((rendered.html.match(/>Unsubscribe<\/a>/g) ?? []).length, 2);
  assert.equal(rendered.headers['List-Unsubscribe'], `<${unsubscribeUrl}>`);
  assert.equal(
    rendered.headers['List-Unsubscribe-Post'],
    'List-Unsubscribe=One-Click',
  );
  const secret = 'synthetic-secret-with-more-than-32-bytes';
  const tokens = ['subscriber-one', 'subscriber-two'].map((id) =>
    subscriberUnsubscribeToken(id, secret),
  );
  assert.notEqual(tokens[0], tokens[1]);
  for (const token of tokens) {
    const recipient = renderNewsletterEmail({
      ...presentation,
      articleId,
      markdown,
      title: 'Fixture',
      privacyUrl,
      unsubscribeUrl: `https://leonlins.com/api/newsletter/unsubscribe?token=${token}`,
    });
    assert.ok(recipient.html.split('<footer')[1].includes(`token=${token}`));
    assert.ok(recipient.headers['List-Unsubscribe'].includes(token));
  }
  const config = {
    NEWSLETTER_ENVIRONMENT: 'production',
    AWS_REGION: 'us-east-2',
    SES_CONFIGURATION_SET: 'fixture',
    NEWSLETTER_MAX_PRODUCTION_RECIPIENTS: '1',
    NEWSLETTER_UNSUBSCRIBE_SECRET: secret,
  };
  assert.throws(
    () => productionSendConfig(config),
    /NEWSLETTER_POSTAL_ADDRESS/,
  );
  for (const invalid of [
    '',
    'TBD',
    'your mailing address',
    'https://example.com/address',
    'author@example.com',
    'x'.repeat(501),
  ])
    assert.throws(
      () =>
        newsletterPresentation({ NEWSLETTER_POSTAL_ADDRESS: invalid }, true),
      /NEWSLETTER_POSTAL_ADDRESS/,
    );
  assert.equal(
    newsletterPresentation(
      { NEWSLETTER_POSTAL_ADDRESS: '  ' + address + '\nCountry  ' },
      true,
    ).postalAddress,
    address + '\nCountry',
  );
  const digest = campaignContentHash(
    articleId,
    'Fixture edition',
    markdown,
    privacyUrl,
    presentation,
  );
  for (const changed of [
    { ...presentation, postalAddress: address + ', revised' },
    { ...presentation, preheader: false },
  ])
    assert.throws(
      () =>
        assertCampaignContent(
          digest,
          campaignContentHash(
            articleId,
            'Fixture edition',
            markdown,
            privacyUrl,
            changed,
          ),
        ),
      /differs/,
    );
  const long = renderNewsletterEmail({
    ...presentation,
    articleId,
    markdown:
      markdown +
      '\n\n' +
      ('A substantial paragraph. '.repeat(15) + '\n\n').repeat(70) +
      'TAIL_SENTINEL',
    title: 'Long article',
    privacyUrl,
    unsubscribeUrl,
  });
  assert.ok(Buffer.byteLength(long.html) < GMAIL_CLIP_LIMIT_BYTES);
  assert.ok(long.html.indexOf('TAIL_SENTINEL') < long.html.indexOf('<footer'));

  let reads = 0;
  const image = await sharp({
    create: { width: 2, height: 2, channels: 3, background: '#123456' },
  })
    .png()
    .toBuffer();
  const request: typeof fetch = async (input, options) => {
    reads++;
    assert.equal(options?.method, 'GET');
    assert.equal(options?.redirect, 'error');
    if (String(input) === url)
      return new Response(
        `<html><head><link href="${url}" rel="canonical"></head><body>Published article</body></html>`,
        { headers: { 'content-type': 'text/html; charset=utf-8' } },
      );
    assert.equal(String(input), 'https://example.com/chart.png');
    return new Response(image, { headers: { 'content-type': 'image/png' } });
  };
  assert.equal(
    await assertPublishedNewsletterPage(articleId, markdown, request),
    url,
  );
  const env = {
    NEWSLETTER_TEST_RECIPIENTS: 'approved@example.com',
    AWS_REGION: 'us-east-2',
    SES_CONFIGURATION_SET: 'fixture',
    NEWSLETTER_POSTAL_ADDRESS: address,
  };
  reads = 0;
  const hostedMarkdown =
    markdown + '\n\n![Hosted](https://example.com/chart.png)';
  const message = await buildTestEmail({
    articleId,
    markdown: hostedMarkdown,
    recipient: 'approved@example.com',
    env,
    hosted: true,
    request,
    resolveAddresses: async () => ['93.184.216.34'],
  });
  assert.match(
    message.Content!.Simple!.Body!.Html!.Data!,
    /href="https:\/\/example.com\/chart.png" title="Open image at original size"/,
  );
  const authorLinked = renderNewsletterEmail({
    ...presentation,
    articleId,
    markdown:
      markdown +
      '\n\n[![Chart](https://example.com/chart.png)](https://example.com/source)',
    title: 'Fixture',
    privacyUrl,
    unsubscribeUrl,
  });
  assert.match(authorLinked.html, /href="https:\/\/example.com\/source"/);
  assert.doesNotMatch(authorLinked.html, /Open image at original size/);
  assert.equal(reads, 2);
  assert.deepEqual(message.Destination, {
    ToAddresses: ['approved@example.com'],
  });
  assert.match(
    message.Content!.Simple!.Subject!.Data!,
    /^\[TEST\] Fixture edition — preview /,
  );
  assert.match(
    message.Content!.Simple!.Body!.Html!.Data!,
    /<h1[^>]*>Fixture edition<\/h1>/,
  );
  assert.match(
    message.Content!.Simple!.Body!.Html!.Data!,
    /src="https:\/\/example.com\/chart.png"/,
  );
  assert.equal(message.Content!.Simple!.Attachments, undefined);
  assert.match(
    message.Content!.Simple!.Body!.Html!.Data!,
    /test-only-not-a-subscriber/,
  );
  reads = 0;
  await assert.rejects(
    () =>
      buildTestEmail({
        articleId,
        markdown,
        recipient: 'other@example.com',
        env,
        hosted: true,
        request,
      }),
    /NEWSLETTER_TEST_RECIPIENTS/,
  );
  await assert.rejects(
    () =>
      buildTestEmail({
        articleId,
        markdown,
        recipient: 'approved@example.com',
        env: { ...env, NEWSLETTER_POSTAL_ADDRESS: '' },
        hosted: true,
        request,
      }),
    /NEWSLETTER_POSTAL_ADDRESS/,
  );
  await assert.rejects(
    () =>
      buildTestEmail({
        articleId,
        markdown: markdown.replace('draft: false', 'draft: true'),
        recipient: 'approved@example.com',
        env,
        hosted: true,
        request,
      }),
    /Draft/,
  );
  assert.equal(reads, 0);
  for (const response of [
    new Response('missing', { status: 404 }),
    new Response('redirect', { status: 301 }),
    new Response('login', { headers: { 'content-type': 'text/html' } }),
    new Response(`<link rel="canonical" href="https://leonlins.com/">`, {
      headers: { 'content-type': 'text/html' },
    }),
    new Response('{}', { headers: { 'content-type': 'application/json' } }),
  ])
    await assert.rejects(
      () =>
        assertPublishedNewsletterPage(
          articleId,
          markdown,
          async () => response,
        ),
      /Published article preflight failed/,
    );
  await assert.rejects(
    () =>
      assertPublishedNewsletterPage(articleId, markdown, async () => {
        throw new Error('network error');
      }),
    /preflight failed/,
  );
  // Exercise the real CLI: invalid flags must fail before content, SES or DB work.
  // No credentials/configuration are inherited, and the article cannot exist.
  for (const flags of [
    [],
    ['--hosted'],
    ['--hosted', '--confirm-test', '--confirm-test'],
    ['--confirm-test', '--unknown'],
  ]) {
    const child = spawnSync(
      process.execPath,
      [
        '--import',
        './tests/register-loaders.mjs',
        '--loader',
        'ts-node/esm',
        'scripts/newsletter/test-send.ts',
        '__guard_fixture__/index.md',
        'approved@example.com',
        ...flags,
      ],
      {
        encoding: 'utf8',
        env: { PATH: process.env.PATH, TS_NODE_PROJECT: 'tsconfig.test.json' },
      },
    );
    assert.notEqual(child.status, 0);
    assert.match(child.stderr, /Usage: npm run newsletter:test/);
    assert.equal(child.stdout, '');
  }
  const sender = readFileSync('scripts/newsletter/send-campaign.ts', 'utf8');
  for (const check of [
    'assertPublishedNewsletterPage',
    'assertPublicNewsletterImages',
  ]) {
    const position = sender.indexOf(`await ${check}`);
    assert.ok(position >= 0);
    assert.ok(position < sender.indexOf('const ses = new SESv2Client'));
    assert.ok(position < sender.indexOf('await db`UPDATE'));
  }
  assert.equal((sender.match(/\.\.\.config.presentation/g) ?? []).length, 2);
  console.log(
    '✅ Newsletter layout, canonical page, preheader, footnotes, postal footer and hosted allowlist preview checks passed (mock HTTP, no SES/DB)',
  );
}
