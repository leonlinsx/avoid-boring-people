// Coverage for content collections, search index generation, RSS, and Instagram publishing.

import assert from 'node:assert/strict';
import { __setMockGetCollectionImplementation, z } from 'astro:content';
import { computeCleanSlug } from '../../src/utils/slug-helpers.ts';
import {
  enrichPost,
  getAllPostsPaginated,
  getCategoryPostsPaginated,
  setGetCollectionImplementation,
  type BlogPost,
} from '../../src/utils/text.ts';
import { extractHeadings } from '../../src/utils/toc.ts';
import { normalizeHeroImage } from '../../src/utils/hero.ts';
import { makeCollectionEntry } from '../helpers/fixtures.ts';

export function testEnrichPost() {
  const heroMeta = {
    src: '/images/hero.webp',
    width: 1200,
    height: 630,
    format: 'webp',
  };

  const baseEntry = makeCollectionEntry({
    data: {
      category: '  Investing  ',
      tags: ['macro', 'rates'],
      heroImage: heroMeta,
    },
  });

  const enriched = enrichPost(baseEntry as any);

  assert.equal(enriched.slug, computeCleanSlug(baseEntry as any));
  assert.equal(enriched.data.category, 'Investing');
  assert.equal(enriched.data.categoryNormalized, 'investing');
  assert.deepEqual(enriched.data.tags, ['macro', 'rates']);
  assert.equal(enriched.data.heroImage, heroMeta);
  assert.ok(enriched.data.readingTime >= 1);

  const relativeEntry = makeCollectionEntry({
    id: '2024_05_02_custom/index.mdx',
    data: {
      category: 'Technology',
      tags: 'not-array',
      heroImage: './cover.webp',
    },
  });

  const relativeHero = enrichPost(relativeEntry as any);

  assert.equal(relativeHero.slug, computeCleanSlug(relativeEntry as any));
  assert.deepEqual(relativeHero.data.tags, []);
  assert.equal(relativeHero.data.heroImage, '/2024_05_02_custom/cover.webp');

  const absoluteEntry = makeCollectionEntry({
    id: '2024_05_03_absolute.md',
    data: {
      heroImage: '/images/custom.png',
    },
  });

  const absoluteHero = enrichPost(absoluteEntry as any);

  assert.equal(absoluteHero.data.heroImage, '/images/custom.png');

  const nestedRelative = makeCollectionEntry({
    id: '2024_05_04_nested/post.mdx',
    data: {
      heroImage: '../shared/banner.png',
    },
  });

  const nestedHero = enrichPost(nestedRelative as any);

  assert.equal(
    nestedHero.data.heroImage,
    '/2024_05_04_nested/shared/banner.png',
  );
}

export function testNormalizeHeroImageHelper() {
  const meta = {
    src: '/images/hero.webp',
    width: 100,
    height: 100,
    format: 'webp',
  } as const;

  assert.equal(normalizeHeroImage(meta, '2024_05_01_meta/index.md'), meta);
  assert.equal(
    normalizeHeroImage('./cover.webp', '2024_05_02_custom/index.mdx'),
    '/2024_05_02_custom/cover.webp',
  );
  assert.equal(
    normalizeHeroImage('../shared/cover.webp', 'blog/2024/post.mdx'),
    '/blog/2024/shared/cover.webp',
  );
  assert.equal(
    normalizeHeroImage('/images/direct.png', '2024_05_03_absolute.mdx'),
    '/images/direct.png',
  );
  assert.equal(normalizeHeroImage(null, '2024_05_04.md'), undefined);
}

export async function testGetAllPostsPaginated() {
  const posts = [
    makeCollectionEntry({
      id: '2024_06_01_first/index.md',
      data: {
        title: 'First',
        category: 'Investing',
        pubDate: new Date('2024-06-01T00:00:00Z'),
      },
    }),
    makeCollectionEntry({
      id: '2024_06_10_second/index.md',
      data: {
        title: 'Second',
        category: 'Technology',
        pubDate: new Date('2024-06-10T00:00:00Z'),
      },
    }),
    makeCollectionEntry({
      id: '2024_05_01_third/index.md',
      data: {
        title: 'Third',
        category: 'Investing',
        pubDate: new Date('2024-05-01T00:00:00Z'),
      },
    }),
  ];

  setGetCollectionImplementation(async (collection) => {
    assert.equal(collection, 'blog');
    return posts as any;
  });

  try {
    const paginateCalls: any[] = [];
    const paginate = ((items: BlogPost[], options: any) => {
      paginateCalls.push({ items, options });
      const chunks = [] as any[];
      for (let i = 0; i < items.length; i += options.pageSize) {
        chunks.push({
          props: {
            pageNumber: chunks.length + 1,
            items: items.slice(i, i + options.pageSize),
          },
        });
      }
      return chunks;
    }) as any;

    const { pages, categories } = await getAllPostsPaginated(paginate, 2);

    assert.deepEqual(categories, ['investing', 'technology']);
    assert.equal(paginateCalls.length, 1);
    assert.equal(paginateCalls[0].options.pageSize, 2);
    assert.deepEqual(
      pages.map((page) =>
        page.props.items.map((post: BlogPost) => post.data.title),
      ),
      [['Second', 'First'], ['Third']],
    );
  } finally {
    setGetCollectionImplementation(null);
  }
}

export async function testGetCategoryPostsPaginated() {
  const posts = [
    makeCollectionEntry({
      id: '2024_01_01_alpha/index.md',
      data: {
        title: 'Alpha',
        category: 'Investing',
        pubDate: new Date('2024-01-01T00:00:00Z'),
      },
    }),
    makeCollectionEntry({
      id: '2024_02_01_beta/index.md',
      data: {
        title: 'Beta',
        category: 'Investing',
        pubDate: new Date('2024-02-01T00:00:00Z'),
      },
    }),
    makeCollectionEntry({
      id: '2024_03_01_gamma/index.md',
      data: {
        title: 'Gamma',
        category: 'Technology',
        pubDate: new Date('2024-03-01T00:00:00Z'),
      },
    }),
  ];

  setGetCollectionImplementation(async () => posts as any);

  try {
    const paginateHistory: any[] = [];
    const paginate = ((items: BlogPost[], options: any) => {
      paginateHistory.push({ items, options });
      return [
        {
          props: {
            pageItems: items,
          },
        },
      ];
    }) as any;

    const routes = await getCategoryPostsPaginated(paginate, 10);

    assert.equal(routes.length, 2);
    assert.deepEqual(
      routes.map((route) => ({
        activeCategory: route.props.activeCategory,
        titles: route.props.pageItems.map((p: BlogPost) => p.data.title),
        categories: route.props.categories,
      })),
      [
        {
          activeCategory: 'investing',
          titles: ['Beta', 'Alpha'],
          categories: ['investing', 'technology'],
        },
        {
          activeCategory: 'technology',
          titles: ['Gamma'],
          categories: ['investing', 'technology'],
        },
      ],
    );

    assert.deepEqual(
      paginateHistory.map((call) => call.options.params.category),
      ['investing', 'technology'],
    );
  } finally {
    setGetCollectionImplementation(null);
  }
}

export function testExtractHeadings() {
  const html = `
    <h1 id="title">Main</h1>
    <h2 class="lead" data-info="intro" id='intro'>Intro <em>section</em></h2>
    <h3 data-extra="1" class="sub" id="details">Details <code>code</code></h3>
    <h3 class="loose" id=unquoted>Loose <strong>quotes</strong></h3>
    <h4 id="ignore">Ignore</h4>
    <h2 data-test="x" id="closing">Closing</h2>
  `;

  const headings = extractHeadings(html);
  assert.deepEqual(headings, [
    { level: 2, id: 'intro', text: 'Intro section' },
    { level: 3, id: 'details', text: 'Details code' },
    { level: 3, id: 'unquoted', text: 'Loose quotes' },
    { level: 2, id: 'closing', text: 'Closing' },
  ]);
}

export async function withMockGetCollection(
  posts: Array<Record<string, any>>,
  callback: () => Promise<void> | void,
) {
  __setMockGetCollectionImplementation(async () => posts as any);

  try {
    await callback();
  } finally {
    __setMockGetCollectionImplementation(null);
  }
}

export async function testContentSchemaEvergreenDefault() {
  const { collections } = await import('../../src/content/config.ts');
  const schema = (collections.blog as any).schema({ image: () => z.any() });
  const base = {
    title: 'Evergreen default',
    pubDate: new Date('2020-07-22T00:00:00Z'),
    category: 'Technology',
  };

  assert.equal(
    schema.parse({ ...base }).evergreen,
    true,
    'omitted evergreen must resolve to true so articles opt out instead of opting in',
  );
  assert.equal(schema.parse({ ...base, evergreen: true }).evergreen, true);
  assert.equal(schema.parse({ ...base, evergreen: false }).evergreen, false);
}

export async function testSearchIndexEndpoint() {
  const posts = [
    makeCollectionEntry({
      id: '2024_01_01_custom/index.md',
      data: {
        title: 'Custom Title',
        description: 'Custom description',
        slug: '  //custom// ',
        category: 'Finance',
        tags: ['growth', 'markets'],
        pubDate: new Date('2024-01-01T00:00:00Z'),
        evergreen: false,
      },
      body: 'First body text',
    }),
    makeCollectionEntry({
      id: '2024_02_01_second/index.md',
      data: {
        title: 'Second Title',
        description: 'Second description',
        category: 'Markets',
        tags: ['trading'],
        pubDate: new Date('2024-02-01T00:00:00Z'),
        evergreen: true,
      },
      body: 'Second body text',
    }),
  ];

  await withMockGetCollection(posts, async () => {
    const { GET } = await import('../../src/pages/search-index.json.ts');
    const response = await GET();

    assert.equal(response.headers.get('Content-Type'), 'application/json');
    const payload = (await response.json()) as Array<Record<string, any>>;

    assert.deepEqual(payload, [
      {
        id: '2024_01_01_custom/index.md',
        title: 'Custom Title',
        url: '/writing/custom/',
        date: '2024-01-01T00:00:00.000Z',
        content: 'First body text',
        category: 'Finance',
        tags: ['growth', 'markets'],
        evergreen: false,
      },
      {
        id: '2024_02_01_second/index.md',
        title: 'Second Title',
        url: '/writing/second/',
        date: '2024-02-01T00:00:00.000Z',
        content: 'Second body text',
        category: 'Markets',
        tags: ['trading'],
        evergreen: true,
      },
    ]);
  });
}

export async function testRssEndpoint() {
  const posts = [
    makeCollectionEntry({
      id: '2024_01_01_alpha/index.md',
      slug: 'alpha',
      data: {
        title: 'Alpha',
        description: 'Alpha description',
        pubDate: new Date('2024-01-01T00:00:00Z'),
      },
    }),
    makeCollectionEntry({
      id: '2024_02_01_beta/index.md',
      slug: 'beta',
      data: {
        title: 'Beta',
        description: 'Beta description',
        pubDate: new Date('2024-02-01T00:00:00Z'),
      },
    }),
  ];

  await withMockGetCollection(posts, async () => {
    const { GET } = await import('../../src/pages/rss.xml.ts');
    const response = await GET();
    const xml = await response.text();

    assert.match(xml, /<title>Alpha<\/title>/);
    assert.match(xml, /<link>https:\/\/leonlins.com\/writing\/alpha\/<\/link>/);
    assert.match(xml, /<title>Beta<\/title>/);
    assert.match(xml, /<link>https:\/\/leonlins.com\/writing\/beta\/<\/link>/);
  });
}

export async function testInstagramMediaUpload() {
  const {
    BLOB_PATH_HEADER,
    MAX_UPLOAD_BYTES,
    handleInstagramMediaUpload,
    setBlobUploader,
  } = await import('../../src/lib/social/instagram-media.ts');
  const { POST, prerender } = await import(
    '../../src/pages/api/social/instagram-media.ts'
  );
  const { put } = await import('@vercel/blob');

  const endpoint = 'https://leonlins.com/api/social/instagram-media';
  const secret = 'test-media-upload-secret';
  const pathname = 'instagram/2019_02_18_why/0123456789ab/slide-01.jpg';
  const jpeg = Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    Buffer.alloc(64, 1),
  ]);
  const previousSecret = process.env.INSTAGRAM_MEDIA_UPLOAD_SECRET;

  const calls: {
    pathname: string;
    body: Buffer;
    options: Record<string, unknown>;
  }[] = [];
  const uploader = async (
    path: string,
    body: Buffer,
    options: Record<string, unknown>,
  ) => {
    calls.push({ pathname: path, body, options });
    return {
      url: `https://store1.public.blob.vercel-storage.com/${path}`,
      pathname: path,
    };
  };

  const request = (
    options: {
      method?: string;
      headers?: Record<string, string | undefined>;
      body?: Buffer;
    } = {},
  ) => {
    const headers = new Headers({
      authorization: `Bearer ${secret}`,
      'content-type': 'image/jpeg',
      [BLOB_PATH_HEADER]: pathname,
    });
    for (const [key, value] of Object.entries(options.headers ?? {})) {
      if (value === undefined) headers.delete(key);
      else headers.set(key, value);
    }
    const method = options.method ?? 'POST';
    const init: RequestInit = { method, headers };
    // Node's Buffer is not part of the DOM BodyInit union, but undici accepts it.
    if (method === 'POST')
      init.body = (options.body ?? jpeg) as unknown as BodyInit;
    return new Request(endpoint, init);
  };

  const bodyOf = async (response: Response) =>
    (await response.json()) as Record<string, unknown>;

  // Collect what the endpoint logs so secret hygiene can be asserted, and so a
  // rejected upload does not fill the test output with expected failures.
  const logged: string[] = [];
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    logged.push(args.map((arg) => String(arg)).join(' '));
  };

  try {
    // The route is on-demand only, and it delegates to the shared handler.
    assert.equal(prerender, false);
    assert.equal(typeof POST, 'function');

    process.env.INSTAGRAM_MEDIA_UPLOAD_SECRET = secret;

    const method = await handleInstagramMediaUpload(
      request({ method: 'GET' }),
      uploader,
    );
    assert.equal(method.status, 405);
    assert.equal(method.headers.get('allow'), 'POST');

    for (const [label, overrides] of [
      ['missing', { authorization: undefined }],
      ['wrong', { authorization: 'Bearer not-the-secret' }],
      ['same length', { authorization: `Bearer ${'x'.repeat(secret.length)}` }],
      ['not bearer', { authorization: `Basic ${secret}` }],
      ['bare secret', { authorization: secret }],
    ] as const) {
      const rejected = await handleInstagramMediaUpload(
        request({ headers: { ...overrides } }),
        uploader,
      );
      assert.equal(
        rejected.status,
        401,
        `an ${label} credential must be rejected`,
      );
      assert.equal(rejected.headers.get('www-authenticate'), 'Bearer');
      assert.equal(String((await bodyOf(rejected)).error), 'unauthorized');
    }

    const wrongType = await handleInstagramMediaUpload(
      request({ headers: { 'content-type': 'application/octet-stream' } }),
      uploader,
    );
    assert.equal(wrongType.status, 415);

    const notJpeg = await handleInstagramMediaUpload(
      request({ body: Buffer.from('this is not a jpeg') }),
      uploader,
    );
    assert.equal(notJpeg.status, 415);

    const emptyBody = await handleInstagramMediaUpload(
      request({ body: Buffer.alloc(0) }),
      uploader,
    );
    assert.equal(emptyBody.status, 400);

    for (const [label, badPath] of [
      ['missing', undefined],
      ['traversal', 'instagram/../../../etc/0123456789ab/slide-01.jpg'],
      ['wrong prefix', 'media/2019_02_18_why/0123456789ab/slide-01.jpg'],
      [
        'uppercase digest',
        'instagram/2019_02_18_why/0123456789AB/slide-01.jpg',
      ],
      ['short digest', 'instagram/2019_02_18_why/0123456789a/slide-01.jpg'],
      ['wrong file name', 'instagram/2019_02_18_why/0123456789ab/slide-1.jpg'],
      [
        'extra segment',
        'instagram/2019_02_18_why/0123456789ab/deeper/slide-01.jpg',
      ],
    ] as const) {
      const rejected = await handleInstagramMediaUpload(
        request({ headers: { [BLOB_PATH_HEADER]: badPath } }),
        uploader,
      );
      assert.equal(
        rejected.status,
        400,
        `a ${label} object path must be rejected`,
      );
    }

    const declaredTooLarge = await handleInstagramMediaUpload(
      request({ headers: { 'content-length': String(MAX_UPLOAD_BYTES + 1) } }),
      uploader,
    );
    assert.equal(declaredTooLarge.status, 413);

    const actuallyTooLarge = await handleInstagramMediaUpload(
      request({
        body: Buffer.concat([jpeg, Buffer.alloc(MAX_UPLOAD_BYTES + 1)]),
      }),
      uploader,
    );
    assert.equal(actuallyTooLarge.status, 413);

    assert.equal(
      calls.length,
      0,
      'a rejected request must not reach the Blob store',
    );

    const stored = await handleInstagramMediaUpload(request(), uploader);
    assert.equal(stored.status, 200);
    assert.equal(stored.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await bodyOf(stored), {
      url: `https://store1.public.blob.vercel-storage.com/${pathname}`,
      pathname,
      bytes: jpeg.byteLength,
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].pathname, pathname);
    assert.deepEqual([...calls[0].body], [...jpeg]);
    assert.deepEqual(calls[0].options, {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'image/jpeg',
    });

    for (const [label, result] of [
      ['no URL', {}],
      [
        'insecure URL',
        {
          url: `http://store1.public.blob.vercel-storage.com/${pathname}`,
          pathname,
        },
      ],
      [
        'a different object',
        {
          url: 'https://store1.public.blob.vercel-storage.com/other.jpg',
          pathname: 'instagram/2019_02_18_why/ffffffffffff/slide-01.jpg',
        },
      ],
    ] as const) {
      const failed = await handleInstagramMediaUpload(
        request(),
        async () => result,
      );
      assert.equal(
        failed.status,
        502,
        `a store answering with ${label} must fail closed`,
      );
    }

    const failuresLogged = logged.length;
    const thrown = await handleInstagramMediaUpload(request(), async () => {
      throw new Error(`blob exploded with ${secret}`);
    });
    assert.equal(thrown.status, 502);
    assert.equal(String((await bodyOf(thrown)).error), 'upload failed');
    assert.equal(
      logged.length,
      failuresLogged + 1,
      'a store failure must be logged exactly once',
    );
    assert.match(logged[logged.length - 1], /\[redacted\]/);

    // The route's own wiring reaches the Blob SDK through the seam.
    setBlobUploader(uploader);
    try {
      const viaRoute = await POST({ request: request() } as never);
      assert.equal((viaRoute as Response).status, 200);
      assert.equal(calls.at(-1)?.pathname, pathname);
      const viaRouteUnauthorized = await POST({
        request: request({ headers: { authorization: undefined } }),
      } as never);
      assert.equal((viaRouteUnauthorized as Response).status, 401);
    } finally {
      setBlobUploader(put as never);
    }

    // A missing or blank secret makes the endpoint unusable rather than open.
    const uploadsSoFar = calls.length;
    for (const configured of [undefined, '   ']) {
      if (configured === undefined)
        delete process.env.INSTAGRAM_MEDIA_UPLOAD_SECRET;
      else process.env.INSTAGRAM_MEDIA_UPLOAD_SECRET = configured;
      const unconfigured = await handleInstagramMediaUpload(
        request(),
        uploader,
      );
      assert.equal(unconfigured.status, 503);
      assert.equal(
        calls.length,
        uploadsSoFar,
        'an unconfigured endpoint must not upload',
      );
    }
    assert.ok(
      logged.every((line) => !line.includes(secret)),
      'the upload secret must never reach the logs',
    );
  } finally {
    console.error = originalConsoleError;
    if (previousSecret === undefined)
      delete process.env.INSTAGRAM_MEDIA_UPLOAD_SECRET;
    else process.env.INSTAGRAM_MEDIA_UPLOAD_SECRET = previousSecret;
    setBlobUploader(put as never);
  }
}

export async function runContentTests() {
  await testEnrichPost();
  await testGetAllPostsPaginated();
  await testGetCategoryPostsPaginated();
  await testNormalizeHeroImageHelper();
  await testExtractHeadings();
  await testContentSchemaEvergreenDefault();
  await testSearchIndexEndpoint();
  await testRssEndpoint();
  await testInstagramMediaUpload();
}
