import { SESv2Client } from '@aws-sdk/client-sesv2';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import type { CollectionEntry } from 'astro:content';
import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { z } from 'astro/zod';
import { collections } from '../../src/content.config.ts';
import {
  articleIsDraft,
  assertPublishedArticle,
  isPublishedPost,
} from '../../src/utils/publication.ts';
import { readArticleRoutes } from '../../src/utils/article-routes.ts';
import { selectRelatedPosts } from '../../src/utils/related-posts.ts';
import {
  getAllPostsPaginated,
  getCategoryPostsPaginated,
  setGetCollectionImplementation,
} from '../../src/utils/text.ts';
import { __setMockGetCollectionImplementation } from '../mocks/astro-content.ts';
import { GET as search } from '../../src/pages/search-index.json.ts';
import { GET as rss } from '../../src/pages/rss.xml.ts';
import { makeCollectionEntry } from '../helpers/fixtures.ts';
import { buildTestEmail } from '../../src/lib/newsletter/test-message.ts';
import {
  renderPrivateNewsletter,
  embeddedPreviewHtml,
  TEST_UNSUBSCRIBE_URL,
  MAX_PRIVATE_IMAGE_BYTES,
  MAX_PRIVATE_TOTAL_BYTES,
} from '../../src/lib/newsletter/private-preview.ts';
import { renderNewsletterEmail } from '../../src/lib/newsletter/render.ts';
import { assertPublicNewsletterImages } from '../../src/lib/newsletter/public-images.ts';
import {
  campaignContentHash,
  snapshotCampaign,
} from '../../src/lib/newsletter/campaign.ts';
import { makeFakeDb } from '../helpers/harness.ts';

export async function runNewsletterDraftTests() {
  const published = makeCollectionEntry() as CollectionEntry<'blog'>;
  const draft = makeCollectionEntry({
    id: '2099_01_01_private/index.md',
    data: {
      draft: true,
      title: 'Private draft',
      tags: ['private-only'],
      category: 'Culture',
    },
  });
  const typedDraft = draft as CollectionEntry<'blog'>;
  const schema = collections.blog.schema!({
    image: () => z.any(),
  }) as z.ZodType;
  assert.equal(
    (schema.parse(published.data) as { draft: boolean }).draft,
    false,
  );
  assert.equal((schema.parse(draft.data) as { draft: boolean }).draft, true);
  assert.equal(
    schema.safeParse({ ...draft.data, draft: 'true' }).success,
    false,
  );
  assert.equal(
    articleIsDraft('---\r\n"draft": true # private\r\n---\r\nbody'),
    true,
  );
  assert.equal(articleIsDraft('---\ndraft: false\n---\nbody'), false);
  assert.throws(
    () => articleIsDraft('---\ndraft: "false"\n---\n'),
    /true or false/,
  );
  assert.equal(isPublishedPost(published), true);
  assert.throws(
    () => assertPublishedArticle('---\ndraft: true\n---\n'),
    /Draft/,
  );
  assert.deepEqual(selectRelatedPosts(published, [typedDraft]), []);
  __setMockGetCollectionImplementation(async () => [published, draft] as never);
  setGetCollectionImplementation(async () => [published, draft] as never);
  try {
    assert.doesNotMatch(
      await (await search()).text(),
      /Private draft|private-only/,
    );
    assert.doesNotMatch(
      await (await rss()).text(),
      /Private draft|private-only/,
    );
    const paginate = (items: unknown[]) => [
      { params: {}, props: { page: { data: items } } },
    ];
    const archive = await getAllPostsPaginated(paginate);
    assert.equal(archive.pages[0].props.page.data.length, 1);
    assert.ok(!archive.categories.includes('culture'));
    const categories = await getCategoryPostsPaginated(paginate);
    assert.equal(categories.length, 1);
  } finally {
    __setMockGetCollectionImplementation(null);
    setGetCollectionImplementation(null);
  }

  const root = mkdtempSync(join(tmpdir(), 'abp-draft-routes-'));
  try {
    mkdirSync(join(root, 'private'));
    writeFileSync(
      join(root, 'private/index.md'),
      '---\ntitle: Private\ndraft: true\n---\n',
    );
    assert.deepEqual(readArticleRoutes(root), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }

  const directory = mkdtempSync('src/content/blog/2099_01_01_private_test_');
  const articleId = `${directory.slice('src/content/blog/'.length)}/index.md`;
  const png = await sharp({
    create: { width: 2, height: 2, channels: 3, background: '#42aabb' },
  })
    .png()
    .toBuffer();
  writeFileSync(
    join(directory, 'index.md'),
    '---\ntitle: Private\ndraft: true\n---\n',
  );
  writeFileSync(join(directory, 'image.png'), png);
  const input = {
    articleId,
    title: 'Private',
    markdown:
      '---\ntitle: Private\ndraft: true\n---\n\n![alt](./image.png)\n\n![repeat][same]\n\n[same]: image.png',
    privacyUrl: 'https://leonlins.com/privacy',
    unsubscribeUrl: TEST_UNSUBSCRIBE_URL,
  };
  try {
    const rendered = await renderPrivateNewsletter(input);
    assert.equal(rendered.attachments.length, 1);
    assert.equal((rendered.html.match(/src="cid:/g) ?? []).length, 2);
    assert.match(rendered.html, /max-width:100%/);
    assert.match(embeddedPreviewHtml(rendered), /src="data:image\/png;base64,/);
    assert.doesNotMatch(embeddedPreviewHtml(rendered), /src="cid:/);
    const production = renderNewsletterEmail(input);
    assert.match(
      production.html,
      /src="https:\/\/leonlins.com\/newsletter-assets\//,
    );
    assert.doesNotMatch(production.html, /cid:|data:image/);
    const env = {
      NEWSLETTER_TEST_RECIPIENTS: 'allowed@example.com',
      AWS_REGION: 'us-east-2',
      SES_CONFIGURATION_SET: 'fixture',
    };
    const message = await buildTestEmail({
      ...input,
      recipient: ' Allowed@Example.COM ',
      env,
    });
    assert.deepEqual(message.Destination, {
      ToAddresses: ['allowed@example.com'],
    });
    assert.equal(message.Content!.Simple!.Subject!.Data, '[TEST] Private');
    const attachment = message.Content!.Simple!.Attachments![0];
    assert.equal(attachment.ContentDisposition, 'INLINE');
    assert.equal(attachment.ContentTransferEncoding, 'BASE64');
    assert.equal(attachment.ContentType, 'image/png');
    assert.deepEqual(attachment.RawContent, png);
    assert.ok(
      message.Content!.Simple!.Body!.Html!.Data!.includes(
        `cid:${attachment.ContentId}`,
      ),
    );
    assert.match(
      message.Content!.Simple!.Body!.Html!.Data!,
      /test-only-not-a-subscriber/,
    );
    await assert.rejects(
      () => buildTestEmail({ ...input, recipient: 'other@example.com', env }),
      /allowlist|NEWSLETTER_TEST_RECIPIENTS/,
    );
    // Exercise the actual CLI boundary with SES intercepted, not just the builder.
    const argv = process.argv;
    const originalEnv = { ...process.env };
    const send = SESv2Client.prototype.send;
    let sends = 0;
    SESv2Client.prototype.send = (async () => {
      sends++;
      return { MessageId: 'fixture' };
    }) as typeof send;
    const script = pathToFileURL(
      resolve('scripts/newsletter/test-send.ts'),
    ).href;
    try {
      Object.assign(process.env, env);
      process.argv = [
        argv[0],
        'test-send.ts',
        articleId,
        'allowed@example.com',
      ];
      await assert.rejects(() => import(`${script}?missing-confirm`), /Usage/);
      process.argv = [
        argv[0],
        'test-send.ts',
        articleId,
        'allowed@example.com',
        '--confirm-test',
        '--unexpected',
      ];
      await assert.rejects(() => import(`${script}?extra-argument`), /Usage/);
      process.argv = [
        argv[0],
        'test-send.ts',
        articleId,
        'other@example.com',
        '--confirm-test',
      ];
      await assert.rejects(
        () => import(`${script}?off-allowlist`),
        /NEWSLETTER_TEST_RECIPIENTS/,
      );
      assert.equal(sends, 0);
      process.argv = [
        argv[0],
        'test-send.ts',
        articleId,
        'allowed@example.com',
        '--confirm-test',
      ];
      await import(`${script}?approved-fixture`);
      assert.equal(sends, 1);
    } finally {
      process.argv = argv;
      process.env = originalEnv;
      SESv2Client.prototype.send = send;
    }
    for (const image of [
      '../outside.png',
      '%2e%2e/outside.png',
      './missing.png',
      './index.md',
      './image.png?x=1',
    ])
      await assert.rejects(
        () =>
          renderPrivateNewsletter({ ...input, markdown: `![bad](${image})` }),
        /inside|missing|Unsupported/,
      );
    symlinkSync('/etc/passwd', join(directory, 'escape.png'));
    await assert.rejects(
      () =>
        renderPrivateNewsletter({ ...input, markdown: '![bad](./escape.png)' }),
      /symlinks/,
    );
    writeFileSync(join(directory, 'invalid.png'), 'not an image');
    await assert.rejects(
      () =>
        renderPrivateNewsletter({
          ...input,
          markdown: '![bad](./invalid.png)',
        }),
      /Invalid local/,
    );
    writeFileSync(
      join(directory, 'large.png'),
      Buffer.alloc(MAX_PRIVATE_IMAGE_BYTES + 1),
    );
    await assert.rejects(
      () =>
        renderPrivateNewsletter({ ...input, markdown: '![big](./large.png)' }),
      /5 MiB/,
    );
    for (let i = 0; i < 3; i++)
      writeFileSync(
        join(directory, `total-${i}.png`),
        Buffer.alloc(MAX_PRIVATE_TOTAL_BYTES / 2),
      );
    await assert.rejects(
      () =>
        renderPrivateNewsletter({
          ...input,
          markdown: [0, 1, 2]
            .map((i) => `![big](./total-${i}.png)`)
            .join('\n\n'),
        }),
      /10 MiB/,
    );
    for (let i = 0; i < 21; i++)
      writeFileSync(join(directory, `count-${i}.png`), png);
    await assert.rejects(
      () =>
        renderPrivateNewsletter({
          ...input,
          markdown: Array.from(
            { length: 21 },
            (_, i) => `![many](./count-${i}.png)`,
          ).join('\n\n'),
        }),
      /20 files/,
    );
    assert.throws(
      () => campaignContentHash(articleId, 'Private', input.markdown),
      /Draft/,
    );
    const fake = makeFakeDb(() => {
      throw new Error('No draft may query campaigns');
    });
    await assert.rejects(
      () =>
        snapshotCampaign(
          {
            articleId,
            markdown: input.markdown,
            subject: 'Private',
            contentHash: 'a'.repeat(64),
            expected: 1,
            maximum: 1,
            cohortSize: null,
          },
          fake.db,
        ),
      /Draft/,
    );
    assert.equal(fake.queries.length, 0);

    let calls = 0;
    const imageFetch: typeof fetch = async (_url, options) => {
      calls++;
      assert.equal(options?.method, 'GET');
      return new Response(png, { headers: { 'content-type': 'image/png' } });
    };
    assert.equal(
      await assertPublicNewsletterImages(
        production.html,
        imageFetch,
        async () => ['93.184.216.34'],
      ),
      1,
    );
    assert.equal(calls, 1);
    for (const response of [
      new Response('no', { status: 404 }),
      new Response('<html>login</html>', {
        headers: { 'content-type': 'text/html' },
      }),
      new Response('bad bytes', { headers: { 'content-type': 'image/png' } }),
    ])
      await assert.rejects(
        () =>
          assertPublicNewsletterImages(
            production.html,
            async () => response,
            async () => ['93.184.216.34'],
          ),
        /preflight failed/,
      );
    await assert.rejects(
      () =>
        assertPublicNewsletterImages(production.html, imageFetch, async () => [
          '127.0.0.1',
        ]),
      /preflight failed/,
    );
    const cli = readFileSync('scripts/newsletter/send-campaign.ts', 'utf8');
    assert.ok(
      cli.indexOf('await assertPublicNewsletterImages') <
        cli.indexOf('const result = await deliverCampaignBatch'),
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
  console.log(
    '✅ Draft publication filtering, private images/CID, path/size guards and production image preflight passed (no SES/DB)',
  );
}
