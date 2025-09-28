import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { __setMockGetCollectionImplementation } from 'astro:content';
import { computeCleanSlug } from '../src/utils/slug-helpers.ts';
import { searchPosts, normalizeQuery } from '../src/utils/search.ts';
import {
  enrichPost,
  getAllPostsPaginated,
  getCategoryPostsPaginated,
  normalizeCategory,
  setGetCollectionImplementation,
  titleCase,
  type BlogPost,
} from '../src/utils/text.ts';
import { extractHeadings } from '../src/utils/toc.ts';
import { normalizeHeroImage } from '../src/utils/hero.ts';

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception', error);
  process.exitCode = 1;
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled rejection', reason);
  process.exitCode = 1;
});

class FakeClassList {
  private classes = new Set<string>();

  constructor(private readonly element: FakeElement) {}

  setFromString(value: string) {
    this.classes = new Set(value.split(/\s+/).filter(Boolean));
    this.commit();
  }

  add(...tokens: string[]) {
    tokens.forEach((token) => this.classes.add(token));
    this.commit();
  }

  remove(...tokens: string[]) {
    tokens.forEach((token) => this.classes.delete(token));
    this.commit();
  }

  toggle(token: string, force?: boolean) {
    if (force === true) {
      this.classes.add(token);
    } else if (force === false) {
      this.classes.delete(token);
    } else if (this.classes.has(token)) {
      this.classes.delete(token);
    } else {
      this.classes.add(token);
    }
    this.commit();
    return this.classes.has(token);
  }

  contains(token: string) {
    return this.classes.has(token);
  }

  toString() {
    return Array.from(this.classes).join(' ');
  }

  private commit() {
    this.element._syncClassName(this.toString());
  }
}

class FakeFragment {
  children: any[] = [];

  appendChild(child: any) {
    this.children.push(child);
    if (child && typeof child === 'object') {
      child.parent = this;
    }
    return child;
  }
}

class FakeElement {
  readonly tagName: string;
  id = '';
  children: any[] = [];
  dataset: Record<string, string> = {};
  textContent = '';
  value = '';
  type = '';
  parent: any = null;
  classList: FakeClassList;
  private listeners = new Map<string, Set<(event: any) => void>>();
  private _className = '';

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase();
    this.classList = new FakeClassList(this);
  }

  appendChild(child: any) {
    this.children.push(child);
    if (child && typeof child === 'object') {
      child.parent = this;
    }
    return child;
  }

  replaceChildren(...nodes: any[]) {
    this.children = [];
    nodes.forEach((node) => {
      if (node instanceof FakeFragment) {
        node.children.forEach((child) => this.appendChild(child));
      } else {
        this.appendChild(node);
      }
    });
  }

  addEventListener(type: string, handler: (event: any) => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(handler);
  }

  removeEventListener(type: string, handler: (event: any) => void) {
    this.listeners.get(type)?.delete(handler);
  }

  dispatchEvent(event: any) {
    if (!event || typeof event.type !== 'string') {
      throw new Error('Invalid event payload');
    }
    if (!event.target) {
      event.target = this;
    }
    const handlers = this.listeners.get(event.type);
    if (handlers) {
      for (const handler of handlers) {
        handler.call(this, event);
      }
    }
    return true;
  }

  setAttribute(name: string, value: string) {
    (this as any)[name] = value;
  }

  set className(value: string) {
    this._className = value;
    this.classList.setFromString(value);
  }

  get className() {
    return this._className;
  }

  _syncClassName(value: string) {
    this._className = value;
  }
}

class FakeDocument {
  private elements = new Map<string, FakeElement>();

  createElement(tagName: string) {
    return new FakeElement(tagName);
  }

  createDocumentFragment() {
    return new FakeFragment();
  }

  getElementById(id: string) {
    return this.elements.get(id) ?? null;
  }

  register(id: string, element: FakeElement) {
    element.id = id;
    this.elements.set(id, element);
    return element;
  }
}

function makePost(overrides: Record<string, any> = {}) {
  const base = {
    id: '2024_01_01_sample/index.md',
    slug: 'sample',
    body: 'Base body',
    collection: 'blog',
    data: {
      title: 'Base Title',
      description: 'Base description about finance',
      pubDate: new Date('2024-01-01T00:00:00Z'),
      updatedDate: undefined,
      category: 'Finance',
      categoryNormalized: 'finance',
      readingTime: 3,
      tags: ['compounding'],
      heroImage: undefined,
    },
  };

  return {
    ...base,
    ...overrides,
    data: {
      ...base.data,
      ...(overrides.data ?? {}),
    },
  };
}

function makeCollectionEntry(overrides: Record<string, any> = {}) {
  const base = {
    id: '2024_01_01_sample/index.md',
    slug: 'sample',
    body: 'Sample body for reading time calculations.',
    collection: 'blog',
    data: {
      title: 'Sample Title',
      description: 'Sample description',
      pubDate: new Date('2024-01-01T00:00:00Z'),
      updatedDate: undefined,
      category: 'Finance',
      tags: ['markets'],
      heroImage: undefined,
    },
  };

  return {
    ...base,
    ...overrides,
    data: {
      ...base.data,
      ...(overrides.data ?? {}),
    },
  };
}

function makeEntry(overrides: Record<string, any> = {}) {
  const base = {
    id: '2024_01_01_sample/index.md',
    data: {},
  };

  return {
    ...base,
    ...overrides,
    data: {
      ...(base.data ?? {}),
      ...(overrides.data ?? {}),
    },
  };
}

function testSearchPosts() {
  const posts = [
    makePost(),
    makePost({ id: '2024_01_02_other/index.md', slug: 'other' }),
  ];
  assert.deepEqual(searchPosts(posts as any, '   '), posts);

  const shuffled = searchPosts(posts as any, 'base');
  assert.deepEqual(
    shuffled.map((p) => p.id),
    posts.map((p) => p.id),
  );

  const detailedPosts = [
    makePost({
      id: '2024_01_02_growth/index.md',
      slug: 'growth',
      data: {
        title: 'Growth Stocks',
        description: 'Looking at multiples',
        category: 'Markets',
        tags: ['Equities'],
      },
      body: 'This essay analyses venture capital deal flow.',
    }),
    makePost({
      id: '2024_01_03_notes/index.md',
      slug: 'notes',
      data: {
        title: 'Weekly Notes',
        description: 'Digest',
        category: 'Notes',
        tags: ['newsletter'],
      },
      body: 'miscellaneous thoughts',
    }),
  ];

  assert.deepEqual(searchPosts(detailedPosts as any, 'venture'), [detailedPosts[0]]);
  assert.deepEqual(searchPosts(detailedPosts as any, 'markets'), [detailedPosts[0]]);
  assert.deepEqual(searchPosts(detailedPosts as any, 'equities'), [detailedPosts[0]]);
  assert.deepEqual(searchPosts(detailedPosts as any, 'digest'), [detailedPosts[1]]);
  assert.deepEqual(
    searchPosts(detailedPosts as any, 'venture capital'),
    [detailedPosts[0]],
  );
  assert.equal(searchPosts(detailedPosts as any, 'nonexistent').length, 0);
}

function testComputeCleanSlug() {
  assert.equal(
    computeCleanSlug(makeEntry({ data: { slug: 'custom-slug' } })),
    'custom-slug',
  );
  assert.equal(
    computeCleanSlug(makeEntry({ id: '2024_02_03_new-idea.md' })),
    'new-idea',
  );
  assert.equal(
    computeCleanSlug(makeEntry({ id: '2024_02_03_new-idea/index.md' })),
    'new-idea',
  );
  assert.equal(
    computeCleanSlug(
      makeEntry({ id: '2024_02_03_new-idea/index.mdx' }),
    ),
    'new-idea',
  );
  assert.equal(
    computeCleanSlug(
      makeEntry({ data: { slug: '  /custom-slug/ ' } }),
    ),
    'custom-slug',
  );
}

function testNormalizeQuery() {
  assert.equal(normalizeQuery('   Venture   Deals  '), 'venture deals');
  assert.equal(normalizeQuery('\n\t  MIXED Case  '), 'mixed case');
}

function testTitleCase() {
  assert.equal(titleCase('hello world'), 'Hello World');
  assert.equal(titleCase('multi\nline text'), 'Multi\nLine Text');
  assert.equal(titleCase(''), '');
  assert.equal(titleCase(undefined as any), '');
}

function testNormalizeCategory() {
  assert.equal(normalizeCategory(' Finance '), 'finance');
  assert.equal(normalizeCategory(undefined as any), '');
}

function testEnrichPost() {
  const heroMeta = {
    src: '/images/hero.webp',
    width: 1200,
    height: 630,
    format: 'webp',
  };

  const baseEntry = makeCollectionEntry({
    data: {
      category: '  Markets  ',
      tags: ['macro', 'rates'],
      heroImage: heroMeta,
    },
  });

  const enriched = enrichPost(baseEntry as any);

  assert.equal(enriched.slug, computeCleanSlug(baseEntry as any));
  assert.equal(enriched.data.category, 'Markets');
  assert.equal(enriched.data.categoryNormalized, 'markets');
  assert.deepEqual(enriched.data.tags, ['macro', 'rates']);
  assert.equal(enriched.data.heroImage, heroMeta);
  assert.ok(enriched.data.readingTime >= 1);

  const relativeEntry = makeCollectionEntry({
    id: '2024_05_02_custom/index.mdx',
    data: {
      category: 'Notes',
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

function testNormalizeHeroImageHelper() {
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

async function testSearchPageClient() {
  const posts = [
    {
      id: '2024_01_01_alpha/index.md',
      slug: 'alpha',
      title: 'Alpha Insights',
      description: 'Thoughts on markets',
      category: 'Markets',
      pubDate: '2024-01-01T00:00:00.000Z',
      readingTime: 4,
      heroImage: {
        kind: 'asset',
        src: '/images/alpha.webp',
        width: 800,
        height: 600,
      },
      fallbackImage: '/fallback.png',
    },
    {
      id: '2024_01_02_beta/index.md',
      slug: 'beta',
      title: 'Weekly Markets',
      description: 'Digest of weekly moves',
      category: 'Finance',
      pubDate: '2024-01-02T00:00:00.000Z',
      readingTime: 6,
      heroImage: null,
      fallbackImage: '/fallback.png',
    },
  ];

  const document = new FakeDocument();
  const input = document.register('client-search-input', document.createElement('input'));
  input.type = 'search';
  const postList = document.register('post-list', document.createElement('div'));
  const emptyState = document.register('search-empty', document.createElement('p'));
  emptyState.className = 'search-empty';
  const dataEl = document.register('search-data', document.createElement('script'));
  dataEl.textContent = JSON.stringify(posts);

  const baseLocation = new URL('https://example.com/writing/search/');
  const windowStub: any = {
    location: new URL(baseLocation.toString()),
    history: {
      replaceState(_state: unknown, _title: string, url: URL | string) {
        const next = typeof url === 'string' ? new URL(url, baseLocation) : new URL(url.toString());
        windowStub.location = next;
      },
    },
  };

  const previousWindow = (globalThis as any).window;
  const previousDocument = (globalThis as any).document;
  const previousHistory = (globalThis as any).history;

  (globalThis as any).window = windowStub;
  (globalThis as any).document = document;
  (globalThis as any).history = windowStub.history;

  try {
    const { initSearchPage } = await import('../src/scripts/search-page.ts');
    const controller = initSearchPage();
    assert.ok(controller);

    assert.deepEqual(
      postList.children.map((child: any) => child.dataset.postId),
      posts.map((post) => post.id),
    );
    assert.equal(emptyState.classList.contains('is-visible'), false);

    input.value = 'weekly';
    input.dispatchEvent({ type: 'input', target: input });

    assert.deepEqual(
      postList.children.map((child: any) => child.dataset.postId),
      ['2024_01_02_beta/index.md'],
    );
    assert.equal(windowStub.location.search, '?q=weekly');
    assert.equal(emptyState.classList.contains('is-visible'), false);

    input.value = 'unmatched';
    input.dispatchEvent({ type: 'input', target: input });

    assert.equal(postList.children.length, 0);
    assert.ok(emptyState.classList.contains('is-visible'));
    assert.equal(windowStub.location.search, '?q=unmatched');

    input.value = '';
    input.dispatchEvent({ type: 'input', target: input });

    assert.deepEqual(
      postList.children.map((child: any) => child.dataset.postId),
      posts.map((post) => post.id),
    );
    assert.equal(windowStub.location.search, '');

    controller?.destroy();
  } finally {
    if (previousWindow === undefined) {
      delete (globalThis as any).window;
    } else {
      (globalThis as any).window = previousWindow;
    }

    if (previousDocument === undefined) {
      delete (globalThis as any).document;
    } else {
      (globalThis as any).document = previousDocument;
    }

    if (previousHistory === undefined) {
      delete (globalThis as any).history;
    } else {
      (globalThis as any).history = previousHistory;
    }
  }
}

async function testGetAllPostsPaginated() {
  const posts = [
    makeCollectionEntry({
      id: '2024_06_01_first/index.md',
      data: {
        title: 'First',
        category: ' Finance ',
        pubDate: new Date('2024-06-01T00:00:00Z'),
      },
    }),
    makeCollectionEntry({
      id: '2024_06_10_second/index.md',
      data: {
        title: 'Second',
        category: 'Markets',
        pubDate: new Date('2024-06-10T00:00:00Z'),
      },
    }),
    makeCollectionEntry({
      id: '2024_05_01_third/index.md',
      data: {
        title: 'Third',
        category: 'finance',
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

    assert.deepEqual(categories, ['finance', 'markets']);
    assert.equal(paginateCalls.length, 1);
    assert.equal(paginateCalls[0].options.pageSize, 2);
    assert.deepEqual(
      pages.map((page) => page.props.items.map((post: BlogPost) => post.data.title)),
      [
        ['Second', 'First'],
        ['Third'],
      ],
    );
  } finally {
    setGetCollectionImplementation(null);
  }
}

async function testGetCategoryPostsPaginated() {
  const posts = [
    makeCollectionEntry({
      id: '2024_01_01_alpha/index.md',
      data: {
        title: 'Alpha',
        category: 'Finance',
        pubDate: new Date('2024-01-01T00:00:00Z'),
      },
    }),
    makeCollectionEntry({
      id: '2024_02_01_beta/index.md',
      data: {
        title: 'Beta',
        category: 'Finance',
        pubDate: new Date('2024-02-01T00:00:00Z'),
      },
    }),
    makeCollectionEntry({
      id: '2024_03_01_gamma/index.md',
      data: {
        title: 'Gamma',
        category: 'Markets',
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
          activeCategory: 'finance',
          titles: ['Beta', 'Alpha'],
          categories: ['finance', 'markets'],
        },
        {
          activeCategory: 'markets',
          titles: ['Gamma'],
          categories: ['finance', 'markets'],
        },
      ],
    );

    assert.deepEqual(
      paginateHistory.map((call) => call.options.params.category),
      ['finance', 'markets'],
    );
  } finally {
    setGetCollectionImplementation(null);
  }
}


function testExtractHeadings() {
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

async function withMockGetCollection(
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

async function testSearchIndexEndpoint() {
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
      },
      body: 'Second body text',
    }),
  ];

  await withMockGetCollection(posts, async () => {
    const { GET } = await import('../src/pages/search-index.json.ts');
    const response = await GET();

    assert.equal(response.headers.get('Content-Type'), 'application/json');
    const payload = (await response.json()) as Array<Record<string, any>>;

    assert.deepEqual(payload, [
      {
        id: '2024_01_01_custom/index.md',
        title: 'Custom Title',
        url: '/writing/custom/',
        date: '2024-01-01T00:00:00.000Z',
        excerpt: 'Custom description',
        category: 'Finance',
        tags: ['growth', 'markets'],
      },
      {
        id: '2024_02_01_second/index.md',
        title: 'Second Title',
        url: '/writing/second/',
        date: '2024-02-01T00:00:00.000Z',
        excerpt: 'Second description',
        category: 'Markets',
        tags: ['trading'],
      },
    ]);
  });
}

async function testApiSearchIndexEndpoint() {
  const posts = [
    makeCollectionEntry({
      id: '2024_01_01_first/index.md',
      slug: 'first-post',
      data: {
        title: 'First Title',
        description: 'Detailed first post',
        category: 'Finance',
        tags: ['money'],
        pubDate: new Date('2024-01-01T00:00:00Z'),
        heroImage: '/images/first.png',
      },
    }),
    makeCollectionEntry({
      id: '2024_02_01_second/index.md',
      slug: undefined,
      data: {
        title: 'Second Title',
        description: '',
        category: 'Markets',
        tags: ['stocks'],
        pubDate: new Date('2024-02-01T00:00:00Z'),
        heroImage: {
          src: '/images/hero.webp',
          width: 1200,
          height: 630,
        },
      },
    }),
  ];

  await withMockGetCollection(posts, async () => {
    const { GET } = await import('../src/pages/api/search-index.json.ts');
    const response = await GET();

    assert.equal(response.headers.get('Content-Type'), 'application/json');
    const payload = (await response.json()) as Array<Record<string, any>>;

    assert.deepEqual(payload, [
      {
        slug: 'first-post',
        title: 'First Title',
        description: 'Detailed first post',
        category: 'Finance',
        tags: ['money'],
        pubDate: '2024-01-01T00:00:00.000Z',
        heroImage: '/images/first.png',
      },
      {
        slug: '2024_02_01_second/index',
        title: 'Second Title',
        description: '',
        category: 'Markets',
        tags: ['stocks'],
        pubDate: '2024-02-01T00:00:00.000Z',
        heroImage: '/images/hero.webp',
      },
    ]);
  });
}

async function testRssEndpoint() {
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
    const { GET } = await import('../src/pages/rss.xml.ts');
    const response = await GET();
    const xml = await response.text();

    assert.match(xml, /<title>Alpha<\/title>/);
    assert.match(xml, /<link>https:\/\/leonlins.com\/writing\/alpha\/<\/link>/);
    assert.match(xml, /<title>Beta<\/title>/);
    assert.match(xml, /<link>https:\/\/leonlins.com\/writing\/beta\/<\/link>/);
  });
}

function testSearchPageBundledScript() {
  const source = readFileSync(
    new URL('../src/pages/writing/search.astro', import.meta.url),
    'utf8',
  );

  assert.ok(
    source.includes("search-page-init.ts?url"),
    'Search page should load bundled client script asset URL',
  );
  assert.ok(
    source.includes('<script type="module" src={searchClientUrl}></script>'),
    'Search page should reference the resolved client script',
  );
  assert.ok(
    !source.includes("import Fuse from 'fuse.js'"),
    'Search page should not inline Fuse imports',
  );
}

async function run() {
  try {
    testSearchPosts();
    testComputeCleanSlug();
    testNormalizeQuery();
    testTitleCase();
    testNormalizeCategory();
    testEnrichPost();
    await testGetAllPostsPaginated();
    await testGetCategoryPostsPaginated();
    testNormalizeHeroImageHelper();
    testExtractHeadings();
    await testSearchIndexEndpoint();
    await testApiSearchIndexEndpoint();
    await testRssEndpoint();
    await testSearchPageClient();
    testSearchPageBundledScript();
    console.log('✅ All custom tests passed');
  } catch (error) {
    console.error('❌ Test failure', error);
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error('❌ Unhandled failure', error);
  process.exitCode = 1;
});
