import assert from 'node:assert/strict';
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

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception', error);
  process.exitCode = 1;
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled rejection', reason);
  process.exitCode = 1;
});

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
    id: '2024_05_02_custom/index.md',
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
    <h2 id="intro">Intro <em>section</em></h2>
    <h3 id="details">Details <code>code</code></h3>
    <h4 id="ignore">Ignore</h4>
  `;

  const headings = extractHeadings(html);
  assert.deepEqual(headings, [
    { level: 2, id: 'intro', text: 'Intro section' },
    { level: 3, id: 'details', text: 'Details code' },
  ]);
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
    testExtractHeadings();
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
