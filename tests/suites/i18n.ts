// Focused coverage for minimal multilingual article support: locale routing,
// canonical/hreflang behavior, selector visibility, translation CLI behavior,
// and the guarantee that translations cannot leak into the English blog
// collection or distribution systems.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { z } from 'astro/zod';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import {
  BLOG_CONTENT_DIR,
  STATIC_LASTMOD,
  readArticleRoutes,
  resolveLastmod,
  serializeSitemapItem,
} from '../../src/utils/article-routes.ts';
import {
  ENGLISH,
  LOCALES,
  articleChrome,
  availableLocalesForEntry,
  buildHreflangLinks,
  computeSourceHash,
  contentEntryName,
  englishPathname,
  languageSelectorEntries,
  localeByCode,
  localeByPrefix,
  localizeRelatedPosts,
  localizedPathname,
  readTranslatedEntries,
  stripLocalePrefix,
} from '../../src/utils/i18n.ts';
import {
  discussionChrome,
  newsletterChrome,
} from '../../src/utils/locale-chrome.ts';
import {
  MAX_CHUNK_CHARS,
  markdownStructureFingerprint,
  TRANSLATOR_MAX_CHARS_PER_MINUTE,
  TRANSLATOR_MAX_RETRIES,
  TranslationThrottle,
  composeTranslatedFile,
  getFrontmatterValue,
  listSourceEntries,
  protectMarkdown,
  readTargetHash,
  readTranslatorCredentials,
  restoreProtectedText,
  reuseSourceAssets,
  splitFrontmatter,
  splitIntoChunks,
  translateProtectedBody,
  translateTexts,
  validateMarkdownStructure,
} from '../../scripts/i18n/lib.ts';
import { REPO_ROOT } from '../helpers/harness.ts';

export function testLocaleDefinitions() {
  assert.deepEqual(
    LOCALES.map((locale) => locale.code),
    ['ja', 'ko', 'es', 'pt-BR', 'fr', 'zh-Hans'],
  );
  assert.deepEqual(
    LOCALES.map((locale) => locale.prefix),
    ['ja', 'ko', 'es', 'pt', 'fr', 'zh'],
    'URL prefixes stay short while hreflang keeps pt-BR and zh-Hans',
  );
  assert.deepEqual(
    LOCALES.map((locale) => locale.ogLocale),
    ['ja_JP', 'ko_KR', 'es_ES', 'pt_BR', 'fr_FR', 'zh_CN'],
  );
  for (const locale of LOCALES) {
    assert.ok(locale.label.trim(), `${locale.code} needs a display name`);
    assert.doesNotMatch(
      locale.label,
      /[\u{1F1E6}-\u{1F1FF}\u{1F310}\u{1F30D}\u{1F30E}]/u,
      'no flags or globe icons in language names',
    );
    assert.ok(
      locale.translatorTarget,
      `${locale.code} needs a Google Cloud Translation target`,
    );
  }
  assert.equal(ENGLISH.code, 'en');
  assert.equal(ENGLISH.label, 'English');
  assert.equal(ENGLISH.ogLocale, 'en_US');

  assert.equal(localeByPrefix('pt')?.code, 'pt-BR');
  assert.equal(localeByPrefix('zh')?.code, 'zh-Hans');
  assert.equal(localeByCode('pt-BR')?.prefix, 'pt');
  assert.equal(localeByCode('zh-Hans')?.prefix, 'zh');
  assert.equal(localeByPrefix('en'), undefined);
  assert.deepEqual(
    Object.fromEntries(
      LOCALES.map((locale) => [locale.code, locale.translatorTarget]),
    ),
    {
      ja: 'ja',
      ko: 'ko',
      es: 'es',
      'pt-BR': 'pt',
      fr: 'fr',
      'zh-Hans': 'zh-CN',
    },
  );
  assert.equal(localizedPathname('ja', 'kelly'), '/ja/writing/kelly');
  assert.equal(localizedPathname('pt', 'kelly'), '/pt/writing/kelly');
  assert.equal(englishPathname('kelly'), '/writing/kelly');
}

export function testHreflangLinks() {
  const origin = 'https://leonlins.com';

  // English page: self, existing translations, x-default to English.
  assert.deepEqual(
    buildHreflangLinks({
      siteOrigin: origin,
      slug: 'kelly',
      availableCodes: ['ja', 'pt-BR'],
    }),
    [
      { hrefLang: 'en', href: `${origin}/writing/kelly` },
      { hrefLang: 'ja', href: `${origin}/ja/writing/kelly` },
      { hrefLang: 'pt-BR', href: `${origin}/pt/writing/kelly` },
      { hrefLang: 'x-default', href: `${origin}/writing/kelly` },
    ],
  );

  // Unknown codes and duplicates never produce hreflang entries.
  assert.deepEqual(
    buildHreflangLinks({
      siteOrigin: origin,
      slug: 'kelly',
      availableCodes: ['ja', 'xx', 'ja'],
    }),
    [
      { hrefLang: 'en', href: `${origin}/writing/kelly` },
      { hrefLang: 'ja', href: `${origin}/ja/writing/kelly` },
      { hrefLang: 'x-default', href: `${origin}/writing/kelly` },
    ],
  );

  // Simplified Chinese keeps its full hreflang tag on the short URL.
  const zh = buildHreflangLinks({
    siteOrigin: origin,
    slug: 'kelly',
    availableCodes: ['zh-Hans'],
  });
  assert.ok(
    zh.some(
      (link) =>
        link.hrefLang === 'zh-Hans' &&
        link.href === `${origin}/zh/writing/kelly`,
    ),
  );

  // No translations: only English self plus x-default.
  assert.deepEqual(
    buildHreflangLinks({
      siteOrigin: origin,
      slug: 'kelly',
      availableCodes: [],
    }),
    [
      { hrefLang: 'en', href: `${origin}/writing/kelly` },
      { hrefLang: 'x-default', href: `${origin}/writing/kelly` },
    ],
  );
}

export function testLanguageSelectorEntries() {
  // No translations: a single entry, so the component hides itself.
  const alone = languageSelectorEntries({
    slug: 'kelly',
    currentCode: 'en',
    availableCodes: [],
  });
  assert.equal(alone.length, 1);
  assert.equal(alone[0]?.code, 'en');

  // English page with translations: English stays current and first.
  const english = languageSelectorEntries({
    slug: 'kelly',
    currentCode: 'en',
    availableCodes: ['ja', 'pt-BR'],
  });
  assert.deepEqual(
    english.map((entry) => entry.code),
    ['en', 'ja', 'pt-BR'],
  );
  assert.equal(english.find((entry) => entry.isCurrent)?.code, 'en');
  assert.deepEqual(
    english.map((entry) => entry.href),
    ['/writing/kelly', '/ja/writing/kelly', '/pt/writing/kelly'],
    'navigation must go to real static path-only URLs',
  );

  // Translated page: English plus the existing versions, self marked current.
  const japanese = languageSelectorEntries({
    slug: 'kelly',
    currentCode: 'ja',
    availableCodes: ['ja', 'zh-Hans', 'xx'],
  });
  assert.deepEqual(
    japanese.map((entry) => entry.code),
    ['en', 'ja', 'zh-Hans'],
  );
  assert.equal(japanese.find((entry) => entry.isCurrent)?.code, 'ja');
}

export function testArticleChromeDefaultsToEnglish() {
  assert.equal(articleChrome().relatedPosts, 'Related Posts');
  assert.equal(articleChrome('xx').relatedPosts, 'Related Posts');
  assert.equal(articleChrome('ja').relatedPosts, '関連記事');
  assert.equal(articleChrome('pt-BR').home, 'Início');
  assert.equal(articleChrome('zh-Hans').relatedPosts, '相关文章');
}

export function testLocalizedSitemapLastmod() {
  const lastmod = { '/writing/kelly': '2020-12-02T00:00:00.000Z' };
  for (const locale of LOCALES) {
    const pathname = `/${locale.prefix}/writing/kelly`;
    assert.equal(
      resolveLastmod(pathname, lastmod),
      '2020-12-02T00:00:00.000Z',
      `${pathname} must reuse its English article date`,
    );
    assert.equal(
      serializeSitemapItem({ url: `https://leonlins.com${pathname}/` }, lastmod)
        .lastmod,
      '2020-12-02T00:00:00.000Z',
    );
  }
  assert.equal(
    resolveLastmod('/writing/kelly', lastmod),
    '2020-12-02T00:00:00.000Z',
  );
  assert.equal(resolveLastmod('/about', lastmod), STATIC_LASTMOD);
  assert.equal(stripLocalePrefix('/writing/kelly'), '/writing/kelly');
  assert.equal(stripLocalePrefix('/ja/writing/kelly'), '/writing/kelly');
}

export function testSourceHashIsDeterministic() {
  const body = '---\ntitle: Hi\n---\n\nBody text.\n';
  assert.equal(computeSourceHash(body), computeSourceHash(body));
  assert.equal(
    computeSourceHash(body),
    computeSourceHash(body.replace(/\n/g, '\r\n')),
    'line endings must not change the hash',
  );
  assert.notEqual(computeSourceHash(body), computeSourceHash(`${body} More.`));
  assert.match(computeSourceHash(body), /^[0-9a-f]{64}$/);
}

export function testProtectRestoreRoundTrip() {
  const body = [
    '# Heading with **bold** stays translatable',
    '',
    'Read [the docs](https://example.com/page?a=1) and ![alt](./img_1.webp).',
    '',
    '```js',
    'const url = "https://example.com/never-touch";',
    '```',
    '',
    'Use `inline(code)` here, a bare https://example.com/bare link,',
    'a footnote[^1], and a [reference][ref].',
    '',
    '[^1]: https://example.com/note',
    '',
    '[ref]: https://example.com/ref "Title"',
    '',
    '<div class="note">html survives</div>',
    '',
  ].join('\n');
  const guarded = protectMarkdown(body);
  assert.ok(
    guarded.text.includes('__I18NPH'),
    'untranslatable spans become placeholders',
  );
  assert.ok(
    guarded.text.includes('Heading with **bold** stays translatable'),
    'prose and inline Markdown stay translatable',
  );
  assert.ok(
    !guarded.text.includes('[the docs]('),
    'complete links stay protected from Markdown syntax changes',
  );
  // Identity "translation": nothing protected may change.
  assert.equal(
    restoreProtectedText({ text: guarded.text, slots: guarded.slots }),
    body,
  );
  // Simulated translation: protected spans survive around translated prose.
  const fakeTranslated = {
    text: guarded.text.replace('Heading with', '見出し with'),
    slots: guarded.slots,
  };
  const restored = restoreProtectedText(fakeTranslated);
  assert.ok(restored.includes('見出し with'));
  assert.ok(restored.includes('https://example.com/page?a=1'));
  assert.ok(restored.includes('./img_1.webp'));
  assert.ok(
    restored.includes('const url = "https://example.com/never-touch";'),
  );
  assert.ok(restored.includes('`inline(code)`'));
  assert.ok(restored.includes('[^1]'));
  assert.ok(restored.includes('[ref]: https://example.com/ref "Title"'));
  assert.ok(restored.includes('<div class="note">'));
}

export function testSplitIntoChunksKeepsPlaceholdersWhole() {
  const text = `First paragraph.\n\nSecond line.\nThird line.\n${'x'.repeat(100)}__I18NPH12__ tail.`;
  const chunks = splitIntoChunks(text, 36);
  assert.equal(chunks.join(''), text);
  assert.equal(chunks[0], 'First paragraph.\n\n');
  assert.equal(chunks[1], 'Second line.\nThird line.\n');
  assert.ok(chunks.every((chunk) => chunk.length <= 36));
  assert.ok(chunks.some((chunk) => chunk.includes('__I18NPH12__')));
  assert.ok(
    chunks.every(
      (chunk) =>
        !chunk.includes('__I18NPH12') || chunk.includes('__I18NPH12__'),
    ),
  );
}

export function testMarkdownValidationSeverities() {
  for (const [source, candidate] of [
    ['- taobao ~4% vs ebay ~9%', '- 淘宝~4%に対しebayは~9%'],
    ['[^rate]: taobao ~4% vs ebay ~9%', '[^rate]: 淘宝~4%に対しebayは~9%'],
    ['Plain prose', 'https://example.com'],
    ['# Heading', 'Heading'],
    ['- first\n- second', '- first second'],
    ['> quoted prose', 'quoted prose'],
    ['[^rate]: Footnote prose', 'Footnote prose'],
    ['![alt](./image.webp)', '![alt](./other.webp)'],
    ['[link](https://example.com/a)', '[link](https://example.com/b)'],
    ['`code`', 'code'],
    ['<div>fixed</div>', '<section>fixed</section>'],
    ['| a | b |\n| - | - |\n| c | d |', '| a |\n| - |\n| c |'],
    [
      'Before [link](https://example.com) After',
      'Before [link](https://example.com)',
    ],
    [
      '[^1]: Rate https://fred.stlouisfed.org/series/DFII10 on 2020-09-14.',
      '[^1]: 金利 https://fred.stlouisfed.org/series/DFII102020年9月14日。',
    ],
  ] as const) {
    assert.equal(
      validateMarkdownStructure(source, candidate).severity,
      'warning',
      source,
    );
  }
  for (const candidate of ['', 'short', 'First section only.']) {
    const source =
      'First section of the article. '.repeat(15) +
      '\n\nSecond major section of the article. '.repeat(15);
    const result = validateMarkdownStructure(source, candidate);
    assert.equal(result.severity, 'hard');
    if (result.severity === 'hard')
      assert.match(result.detail, /substantial prose loss/);
  }
}

export async function testSyntaxAwareMarkdownTranslation() {
  const body = [
    '# Heading alpha',
    '',
    'Paragraph alpha with **strong alpha**, *emphasis alpha*, [link alpha](https://example.com/x), ![image alpha](./img.webp), `code alpha`, and [^note].',
    '',
    '- alpha first',
    '- alpha second',
    '  1. alpha nested one',
    '  2. alpha nested two',
    '',
    '1. alpha ordered one',
    '2. alpha ordered two',
    '',
    '> alpha quote',
    '',
    '| alpha heading | alpha heading |',
    '| --- | --- |',
    '| alpha cell | alpha cell |',
    '',
    '```js',
    'const alpha = "literal";',
    '```',
    '',
    '<div class="note">alpha literal</div>',
    '',
    '[^note]: alpha footnote',
    '',
  ].join('\n');
  const submitted: string[] = [];
  const translating = (async (_url: unknown, options: { body: string }) => {
    const items = requestContents(options);
    assert.ok(
      items.reduce((sum, item) => sum + item.length, 0) <= MAX_CHUNK_CHARS,
    );
    submitted.push(...items.map((item) => item));
    return new Response(
      googleResponse(items.map((item) => item.replaceAll('alpha', '翻訳'))),
      { headers: { 'content-type': 'application/json' } },
    );
  }) as unknown as typeof fetch;
  const translated = await translateProtectedBody(
    body,
    'ja',
    paceCredentials,
    translating,
  );
  assert.equal(
    markdownStructureFingerprint(translated),
    markdownStructureFingerprint(body),
  );
  assert.ok(translated.includes('# Heading 翻訳'));
  assert.ok(translated.includes('- 翻訳 first\n- 翻訳 second'));
  assert.ok(translated.includes('1. 翻訳 ordered one\n2. 翻訳 ordered two'));
  assert.ok(translated.includes('**strong 翻訳**'));
  assert.ok(translated.includes('[link alpha](https://example.com/x)'));
  assert.ok(translated.includes('![image alpha](./img.webp)'));
  assert.ok(translated.includes('`code alpha`'));
  assert.ok(translated.includes('const alpha = "literal";'));
  assert.ok(translated.includes('<div class="note">alpha literal</div>'));
  assert.ok(translated.includes('[^note]: 翻訳 footnote'));
  assert.ok(submitted.every((text) => !/[\r\n]/.test(text)));
  assert.ok(
    submitted.every((text) => !/https?:|__I18N|```|<div|\[\^note\]/.test(text)),
  );

  assert.ok(submitted.every((text) => !text.includes('link alpha')));
  for (const changed of [
    body.replace('# Heading alpha', '## Heading alpha'),
    body.replace('- alpha second', 'alpha second'),
    body.replace('2. alpha ordered two', '3. alpha ordered two'),
    body.replace('[^note]: alpha footnote', '[^other]: alpha footnote'),
    body.replace('and [^note].', 'and [^other].'),
    body.replace('https://example.com/x', 'https://example.com/y'),
    body.replace('./img.webp', './other.webp'),
    body.replace('`code alpha`', '`different code`'),
    body.replace('const alpha = "literal";', 'const alpha = "changed";'),
    body.replace('| alpha cell | alpha cell |', '| alpha cell |'),
    body.replace('<div class="note">', '<section class="note">'),
  ]) {
    assert.notEqual(
      markdownStructureFingerprint(changed),
      markdownStructureFingerprint(body),
    );
  }

  const corrupting = (async (_url: unknown, options: { body: string }) => {
    const items = requestContents(options);
    return new Response(googleResponse(items.map(() => 'x')), {
      headers: { 'content-type': 'application/json' },
    });
  }) as unknown as typeof fetch;
  const diagnosticDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'abp-i18n-diagnostic-'),
  );
  const rejectedCandidatePath = path.join(diagnosticDir, 'rejected.md');
  try {
    await assert.rejects(
      translateProtectedBody(
        'alpha paragraph '.repeat(20),
        'ja',
        paceCredentials,
        corrupting,
        { rejectedCandidatePath },
      ),
      (error: Error) => {
        assert.match(error.message, /substantial prose loss/);
        assert.ok(error.message.includes(rejectedCandidatePath));
        assert.match(error.message, /No files were modified/);
        return true;
      },
    );
    assert.equal(fs.readFileSync(rejectedCandidatePath, 'utf-8'), 'x ');

    fs.unlinkSync(rejectedCandidatePath);
    await translateProtectedBody(
      'alpha paragraph',
      'ja',
      paceCredentials,
      translating,
      { rejectedCandidatePath },
    );
    assert.equal(fs.existsSync(rejectedCandidatePath), false);
  } finally {
    fs.rmSync(diagnosticDir, { recursive: true, force: true });
  }
}

export async function testTextNodeMappingAndEmptyResult() {
  const body = [
    'Alpha  [link](https://example.com/a)  Beta',
    '',
    '[^note]: Gamma  [link](https://example.com/b)  Delta',
    '',
  ].join('\n');
  const requests: string[][] = [];
  const translating = (async (_url: unknown, options: { body: string }) => {
    const items = requestContents(options);
    requests.push(items.map((item) => item));
    return new Response(
      googleResponse(items.map((item, index) => `訳${index}:${item}`)),
      { headers: { 'content-type': 'application/json' } },
    );
  }) as unknown as typeof fetch;
  const translated = await translateProtectedBody(
    body,
    'ja',
    paceCredentials,
    translating,
  );
  assert.deepEqual(requests, [['Alpha', 'Beta', 'Gamma', 'Delta']]);
  assert.equal(
    translated,
    [
      '訳0\\:Alpha  [link](https://example.com/a)  訳1\\:Beta',
      '',
      '[^note]: 訳2\\:Gamma  [link](https://example.com/b)  訳3\\:Delta',
      '',
    ].join('\n'),
  );
  assert.equal(
    markdownStructureFingerprint(translated),
    markdownStructureFingerprint(body),
  );

  for (const empty of ['', '   ']) {
    let calls = 0;
    const emptyFetch = (async (_url: unknown, options: { body: string }) => {
      calls += 1;
      const items = requestContents(options);
      return new Response(
        googleResponse(items.map((item) => (item === 'Gamma' ? empty : item))),
        { headers: { 'content-type': 'application/json' } },
      );
    }) as unknown as typeof fetch;
    const warnings: string[] = [];
    const originalWarn = console.warn;
    console.warn = (message: string) => warnings.push(message);
    try {
      const fallback = await translateProtectedBody(
        body,
        'ja',
        paceCredentials,
        emptyFetch,
        { articleSlug: 'fixture' },
      );
      assert.equal(fallback, body);
      assert.equal(
        markdownStructureFingerprint(fallback),
        markdownStructureFingerprint(body),
      );
      assert.equal(calls, 1, 'empty prose does not trigger a retry');
      assert.deepEqual(warnings, [
        'translation_fallback locale=ja article=fixture source="Gamma"',
      ]);
    } finally {
      console.warn = originalWarn;
    }
  }
}

export async function testTranslatedProseEscapesMarkdownSyntax() {
  const cases = [
    {
      source:
        '- E.g. China e-commerce marketplace rakes: taobao ~4% vs ebay ~9%',
      translated: '例えば、淘宝~4%に対しebayは~9%',
    },
    { source: 'Plain words', translated: '文字 *strong* と _emphasis_' },
    { source: 'Plain words', translated: '[label](https://example.com)' },
    { source: 'Plain words', translated: '`code` and backslash \\ marker' },
    { source: 'Plain words', translated: '<tag attr="x"> and a|b' },
    {
      source: 'Plain words',
      translated:
        'https://example.com and <https://example.com> plus www.example.com and name@example.com',
    },
    { source: 'First line\nSecond line', translated: '最初\n# heading' },
    { source: 'First line\nSecond line', translated: '最初\n- list item' },
    { source: 'First line\nSecond line', translated: '最初\n1. ordered item' },
    { source: 'First line\nSecond line', translated: '最初\n> blockquote' },
  ];
  const parser = unified().use(remarkParse).use(remarkGfm);
  for (const { source, translated } of cases) {
    const translating = (async (_url: unknown, options: { body: string }) => {
      const items = requestContents(options);
      assert.equal(items.length, 1);
      return new Response(googleResponse([translated]), {
        headers: { 'content-type': 'application/json' },
      });
    }) as unknown as typeof fetch;
    const output = await translateProtectedBody(
      source,
      'ja',
      paceCredentials,
      translating,
    );
    assert.equal(
      markdownStructureFingerprint(output),
      markdownStructureFingerprint(source),
      source,
    );
    const values: string[] = [];
    const types: string[] = [];
    const visit = (node: {
      type: string;
      value?: string;
      children?: unknown[];
    }): void => {
      types.push(node.type);
      if (node.type === 'text') values.push(node.value ?? '');
      for (const child of node.children ?? [])
        visit(child as { type: string; value?: string; children?: unknown[] });
    };
    visit(
      parser.parse(output) as unknown as { type: string; children?: unknown[] },
    );
    assert.deepEqual(
      values.map((value) => value.replaceAll('\u2060', '')),
      [translated],
      source,
    );
    assert.ok(
      !types.some((type) =>
        [
          'delete',
          'emphasis',
          'strong',
          'link',
          'inlineCode',
          'html',
          'blockquote',
        ].includes(type),
      ),
      source,
    );
    if (translated.includes('淘宝~4%')) {
      assert.match(output, /淘宝\\~4\\%に対しebayは\\~9\\%/);
    }
  }
}

export async function testLongArticleChunksAndAtomicFailure() {
  const body = [
    `Opening [link](https://example.com/a) and ![image](./img.webp) with \`code\` and [^note].`,
    'A'.repeat(9_800),
    'B'.repeat(9_800),
    'C'.repeat(9_800),
    'D'.repeat(4_000),
    '```js\nconst url = "https://example.com/code";\n```',
  ].join('\n\n');
  assert.ok(body.length > 25_000);
  const submitted: string[] = [];
  let active = 0;
  const translating = (async (_url: unknown, options: { body: string }) => {
    active += 1;
    assert.equal(active, 1, 'body requests must be sequential');
    const items = requestContents(options);
    assert.ok(
      items.reduce((sum, item) => sum + item.length, 0) <= MAX_CHUNK_CHARS,
    );
    submitted.push(...items.map((item) => item));
    active -= 1;
    return new Response(googleResponse(items.map((item) => item)), {
      headers: { 'content-type': 'application/json' },
    });
  }) as unknown as typeof fetch;
  const clock = makeVirtualClock();
  const result = await translateProtectedBody(
    body,
    'ja',
    paceCredentials,
    translating,
    {
      throttle: new TranslationThrottle(clock),
      sleep: clock.sleep,
    },
  );
  assert.ok(submitted.length > 2);
  assert.equal(
    markdownStructureFingerprint(result),
    markdownStructureFingerprint(body),
    'ordering, separators and protected Markdown survive',
  );
  assert.ok(
    ['A', 'B', 'C', 'D']
      .map((letter) =>
        result.indexOf(letter.repeat(letter === 'D' ? 4_000 : 9_800)),
      )
      .every(
        (offset, index, offsets) =>
          offset >= 0 && (index === 0 || offset > offsets[index - 1]!),
      ),
  );
  assert.ok(clock.sleeps.length > 0, 'shared throttle paces the full article');

  let calls = 0;
  const failing = (async (_url: unknown, options: { body: string }) => {
    calls += 1;
    if (calls === 2) return new Response('failed', { status: 500 });
    const items = requestContents(options);
    return new Response(googleResponse(items.map((item) => item)), {
      headers: { 'content-type': 'application/json' },
    });
  }) as unknown as typeof fetch;
  await assert.rejects(
    translateProtectedBody(body, 'ja', paceCredentials, failing, {
      throttle: new TranslationThrottle(makeVirtualClock()),
    }),
    /HTTP 500.*No files were modified/s,
  );
  assert.equal(calls, 2);
}

export function testFailedChunkDoesNotWriteArticle() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-cli-failure-'));
  try {
    writeFile(root, 'package.json', '{"type":"module"}');
    fs.copyFileSync(
      path.join(REPO_ROOT, 'tsconfig.json'),
      path.join(root, 'tsconfig.json'),
    );
    fs.symlinkSync(
      path.join(REPO_ROOT, 'node_modules'),
      path.join(root, 'node_modules'),
      'dir',
    );
    for (const file of [
      'scripts/i18n/lib.ts',
      'scripts/i18n/translate.ts',
      'src/utils/i18n.ts',
      'src/utils/slug-helpers.ts',
      'src/utils/locale-chrome.ts',
      'src/lib/comments/domain.ts',
    ]) {
      writeFile(
        root,
        file,
        fs.readFileSync(path.join(REPO_ROOT, file), 'utf-8'),
      );
    }
    writeFile(
      root,
      'src/content/blog/2024_01_01_fixture/index.md',
      `---\ntitle: Fixture\n---\n\n${'A'.repeat(9_800)}\n\n${'B'.repeat(9_800)}\n\n${'C'.repeat(9_800)}`,
    );
    writeFile(
      root,
      'fake-fetch.mjs',
      `import { GoogleAuth } from 'google-auth-library';
       GoogleAuth.prototype.getAccessToken = async () => 'test-token';
       let bodyCalls = 0;
       globalThis.fetch = async (_url, options) => {
         const [text] = JSON.parse(options.body).contents;
         if (text.length > 1000 && ++bodyCalls === 2) return new Response('failed', { status: 500 });
         return new Response(JSON.stringify({ translations: [{ translatedText: text }] }), {
           headers: { 'content-type': 'application/json' },
         });
       };`,
    );
    const run = spawnSync(
      process.execPath,
      [
        '--import',
        './fake-fetch.mjs',
        '--import',
        'ts-node/esm',
        'scripts/i18n/translate.ts',
        '--locale',
        'ja',
        '--slug',
        'fixture',
      ],
      {
        cwd: root,
        encoding: 'utf-8',
        env: {
          ...process.env,
          TS_NODE_PROJECT: path.join(root, 'tsconfig.json'),
          GOOGLE_CLOUD_PROJECT: 'test-project',
        },
      },
    );
    assert.equal(run.status, 1, run.stderr);
    assert.match(
      run.stderr,
      /translation_failed entry=2024_01_01_fixture locale=ja/,
    );
    const targetFile = path.join(
      root,
      'src/content/i18n/ja/2024_01_01_fixture/index.md',
    );
    assert.equal(fs.existsSync(targetFile), false);

    writeFile(
      root,
      'src/content/blog/2024_01_01_fixture/index.md',
      "---\ntitle: Fixture\nheroImage: './photo.webp'\n---\n\nAlpha  [link](https://example.com)  Beta\n\n![写真](./photo.webp)\n",
    );
    writeFile(
      root,
      'src/content/blog/2024_01_01_fixture/photo.webp',
      'image fixture',
    );
    writeFile(
      root,
      'fake-fetch.mjs',
      `import { GoogleAuth } from 'google-auth-library';
       GoogleAuth.prototype.getAccessToken = async () => 'test-token';
       globalThis.fetch = async (_url, options) => {
         const items = JSON.parse(options.body).contents;
         return new Response(JSON.stringify({ translations: items.map((text) => ({
           translatedText: text === 'Alpha' ? '' : text,
         })) }), { headers: { 'content-type': 'application/json' } });
       };`,
    );
    const emptyRun = spawnSync(
      process.execPath,
      [
        '--import',
        './fake-fetch.mjs',
        '--import',
        'ts-node/esm',
        'scripts/i18n/translate.ts',
        '--locale',
        'ja',
        '--slug',
        'fixture',
      ],
      {
        cwd: root,
        encoding: 'utf-8',
        env: {
          ...process.env,
          TS_NODE_PROJECT: path.join(root, 'tsconfig.json'),
          GOOGLE_CLOUD_PROJECT: 'test-project',
        },
      },
    );
    assert.equal(emptyRun.status, 0, emptyRun.stderr);
    assert.match(
      emptyRun.stderr,
      /translation_fallback locale=ja article=fixture source="Alpha"/,
    );
    assert.equal(fs.existsSync(targetFile), true);
    const sourceBody = splitFrontmatter(
      fs.readFileSync(
        path.join(root, 'src/content/blog/2024_01_01_fixture/index.md'),
        'utf-8',
      ),
    ).body;
    const targetBody = splitFrontmatter(
      fs.readFileSync(targetFile, 'utf-8'),
    ).body;
    const canonicalBody = reuseSourceAssets(
      sourceBody,
      path.join(root, 'src/content/blog/2024_01_01_fixture/index.md'),
      targetFile,
    );
    assert.equal(targetBody, canonicalBody);
    assert.equal(
      markdownStructureFingerprint(targetBody),
      markdownStructureFingerprint(canonicalBody),
    );
    assert.equal(
      fs.existsSync(path.join(path.dirname(targetFile), 'photo.webp')),
      false,
    );
    assert.match(
      fs.readFileSync(targetFile, 'utf8'),
      /heroImage: '\.\.\/\.\.\/\.\.\/blog\/2024_01_01_fixture\/photo.webp'/,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

export function testComposeTranslatedFile() {
  const source = [
    '---',
    "title: 'Original title'",
    "description: 'Original description'",
    'pubDate: 2021-04-03',
    'category: Risk & Decision Making',
    "tags: ['finance', 'risk']",
    "heroImage: './ergo_5.webp'",
    'featured: true',
    '---',
    '',
  ].join('\n');
  const { frontmatter, body } = splitFrontmatter(source);
  assert.equal(getFrontmatterValue(frontmatter, 'title'), 'Original title');
  assert.equal(
    getFrontmatterValue(frontmatter, 'description'),
    'Original description',
  );
  const output = composeTranslatedFile({
    sourceFrontmatter: frontmatter,
    translatedTitle: 'Título "traduzido"',
    translatedDescription: 'Descrição',
    localeCode: 'pt-BR',
    sourceSlug: 'kelly',
    sourceHash: 'abc123',
    translatedBody: 'Corpo.',
  });
  assert.match(output, /^---\ntitle: "Título \\"traduzido\\""\n/);
  assert.ok(output.includes('description: "Descrição"'));
  // Untranslatable fields pass through verbatim.
  for (const line of [
    'pubDate: 2021-04-03',
    'category: Risk & Decision Making',
    "tags: ['finance', 'risk']",
    "heroImage: './ergo_5.webp'",
    'featured: true',
  ]) {
    assert.ok(output.includes(line), `${line} must be preserved verbatim`);
  }
  assert.ok(output.includes("locale: 'pt-BR'"));
  assert.ok(output.includes("sourceSlug: 'kelly'"));
  assert.ok(output.includes("sourceHash: 'abc123'"));
  assert.ok(output.endsWith('Corpo.'));
  assert.equal(body, '');
}

export function testTranslationsReuseCanonicalAssets() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-assets-'));
  try {
    const source = path.join(root, 'blog/article/index.md');
    const target = path.join(root, 'i18n/ja/article/index.md');
    fs.mkdirSync(path.dirname(source), { recursive: true });
    fs.writeFileSync(
      path.join(path.dirname(source), 'photo.webp'),
      'image fixture',
    );
    const input = [
      '---',
      "title: '写真'",
      "heroImage: './photo.webp'",
      '---',
      '写真 ./photo.webp',
      '![写真](./photo.webp "./photo.webp")',
      '[Download](./photo.webp?raw=1#image)',
      '[![写真](./photo.webp)](./photo.webp)',
      '![写真][photo]',
      '',
      '[photo]: <./photo.webp> "写真"',
      '![Remote](https://example.com/photo.webp)',
      '![Public](/photo.webp)',
      '![Missing](./missing.webp)',
      '`![Code](./photo.webp)`',
      '```md',
      '![Code](./photo.webp)',
      '```',
    ].join('\n');
    const output = reuseSourceAssets(input, source, target);
    const canonical = '../../../blog/article/photo.webp';
    assert.equal(
      output,
      input
        .replace("heroImage: './photo.webp'", `heroImage: '${canonical}'`)
        .replace('](./photo.webp "', `](${canonical} "`)
        .replace('](./photo.webp?raw', `](${canonical}?raw`)
        .replace(
          '[![写真](./photo.webp)](./photo.webp)',
          `[![写真](${canonical})](${canonical})`,
        )
        .replace('<./photo.webp>', `<${canonical}>`),
    );
    assert.equal(reuseSourceAssets(output, source, target), output);
    assert.equal(
      fs.existsSync(path.dirname(target)),
      false,
      'rebasing must not copy or write assets',
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }

  // Check the committed corpus too: every shared hero/body reference resolves,
  // and an identical media copy cannot silently return in a locale directory.
  for (const relative of fs.globSync('src/content/i18n/**/*', {
    cwd: REPO_ROOT,
  })) {
    const file = path.join(REPO_ROOT, relative);
    if (!fs.statSync(file).isFile()) continue;
    if (/\.mdx?$/.test(file)) {
      const content = fs.readFileSync(file, 'utf8');
      const urls = [
        ...content.matchAll(/(?:heroImage: ['"]|\]\()(\.\.\/[^'"\s)]+)/g),
      ];
      for (const [, url] of urls) {
        assert.ok(
          fs.existsSync(path.resolve(path.dirname(file), url!)),
          `${relative}: ${url}`,
        );
      }
    } else {
      const canonical = path.join(
        REPO_ROOT,
        'src/content/blog',
        ...relative.split('/').slice(4),
      );
      if (fs.existsSync(canonical) && fs.statSync(canonical).isFile()) {
        assert.equal(
          fs.readFileSync(file).equals(fs.readFileSync(canonical)),
          false,
          `${relative} duplicates a canonical asset; reference it instead`,
        );
      }
    }
  }
}

export function testMissingCredentialsFailClearly() {
  assert.throws(
    () => readTranslatorCredentials({} as NodeJS.ProcessEnv),
    /GOOGLE_CLOUD_PROJECT.*Application Default Credentials.*No files were modified/,
  );
  const credentials = readTranslatorCredentials({
    GOOGLE_CLOUD_PROJECT: 'test-project',
  } as NodeJS.ProcessEnv);
  assert.equal(credentials.projectId, 'test-project');
  assert.equal(credentials.endpoint, 'https://translation.googleapis.com');

  const custom = readTranslatorCredentials({
    GOOGLE_CLOUD_PROJECT: 'test-project',
    GOOGLE_TRANSLATION_ENDPOINT: 'https://example.invalid/',
  } as NodeJS.ProcessEnv);
  assert.equal(custom.endpoint, 'https://example.invalid');
}

export async function testGoogleTranslationRequestAndResponse() {
  let requestedUrl = '';
  let requestedInit: RequestInit | undefined;
  const googleFetch = (async (
    url: string | URL | Request,
    init?: RequestInit,
  ) => {
    requestedUrl = String(url);
    requestedInit = init;
    return new Response(googleResponse(['こんにちは', '世界']), {
      headers: { 'content-type': 'application/json' },
    });
  }) as unknown as typeof fetch;

  assert.deepEqual(
    await translateTexts(
      ['Hello', '', 'world'],
      'ja',
      paceCredentials,
      googleFetch,
    ),
    ['こんにちは', '', '世界'],
  );
  assert.equal(
    requestedUrl,
    'https://example.invalid/v3/projects/test-project/locations/global:translateText',
  );
  assert.equal(requestedInit?.method, 'POST');
  assert.equal(
    new Headers(requestedInit?.headers).get('authorization'),
    'Bearer test-token',
  );
  assert.equal(
    new Headers(requestedInit?.headers).get('x-goog-user-project'),
    'test-project',
  );
  assert.deepEqual(JSON.parse(String(requestedInit?.body)), {
    sourceLanguageCode: 'en',
    targetLanguageCode: 'ja',
    contents: ['Hello', 'world'],
    mimeType: 'text/plain',
    model: 'projects/test-project/locations/global/models/general/nmt',
  });

  const malformed = (async () =>
    new Response(JSON.stringify({ translations: [{}] }), {
      headers: { 'content-type': 'application/json' },
    })) as unknown as typeof fetch;
  await assert.rejects(
    translateTexts(['Hello'], 'ja', paceCredentials, malformed),
    /unexpected response \(ja, item 0\).*No files were modified/,
  );
}

export async function testTranslatorFailureModifiesNothing() {
  const failingFetch = (async () =>
    new Response('quota exceeded', { status: 429 })) as unknown as typeof fetch;
  const credentials = {
    projectId: 'test-project',
    endpoint: 'https://example.invalid',
    getAccessToken: async () => 'test-token',
  };
  // Virtual sleep: the retry backoff must not really wait in tests.
  const clock = makeVirtualClock();
  await assert.rejects(
    translateTexts(['hello'], 'ja', credentials, failingFetch, {
      sleep: clock.sleep,
    }),
    /HTTP 429.*No files were modified/,
  );
  await assert.rejects(
    translateProtectedBody('hello', 'ja', credentials, failingFetch, {
      sleep: clock.sleep,
    }),
    /HTTP 429/,
  );

  // Empty strings never reach the API.
  let calls = 0;
  const countingFetch = (async () => {
    calls += 1;
    return new Response('[]', {
      headers: { 'content-type': 'application/json' },
    });
  }) as unknown as typeof fetch;
  assert.deepEqual(
    await translateTexts(['', '  '], 'ja', credentials, countingFetch),
    ['', ''],
  );
  assert.equal(calls, 0);

  // A successful call translates chunks and restores protected spans.
  const okFetch = (async (_url: unknown, options: { body: string }) => {
    const items = requestContents(options);
    return new Response(googleResponse(items.map((item) => `TR:${item}`)), {
      headers: { 'content-type': 'application/json' },
    });
  }) as unknown as typeof fetch;
  const translated = await translateProtectedBody(
    'Hello [world](https://example.com/x).',
    'ja',
    credentials,
    okFetch,
  );
  assert.ok(translated.startsWith('TR\\:Hello'));
  assert.ok(translated.includes('https://example.com/x'));
}

function writeFile(root: string, relative: string, content: string): string {
  const full = path.join(root, relative);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf-8');
  return full;
}

export function testTranslationStatusClassification() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-status-'));
  try {
    const blogDir = path.join(root, 'blog');
    const i18nDir = path.join(root, 'i18n');
    const first =
      '---\ntitle: First\ndescription: One\npubDate: 2024-01-01\ncategory: Technology\n---\n\nBody one.\n';
    const second =
      '---\ntitle: Second\npubDate: 2024-02-01\ncategory: Technology\n---\n\nBody two.\n';
    writeFile(blogDir, '2024_01_01_first/index.md', first);
    writeFile(blogDir, '2024_02_01_second/index.md', second);

    const entries = listSourceEntries(blogDir);
    assert.equal(entries.length, 2);
    assert.deepEqual(
      entries.map((entry) => entry.slug),
      ['first', 'second'],
    );

    const bySlug = new Map(entries.map((entry) => [entry.slug, entry]));
    const firstEntry = bySlug.get('first');
    const secondEntry = bySlug.get('second');
    assert.ok(firstEntry && secondEntry);

    // Missing: no target file recorded.
    assert.equal(
      readTargetHash(path.join(i18nDir, 'ja', '2024_01_01_first', 'index.md')),
      undefined,
    );

    // Current: recorded hash matches the source hash.
    writeFile(
      i18nDir,
      'ja/2024_01_01_first/index.md',
      `---\ntitle: "JA"\nsourceHash: '${firstEntry.hash}'\n---\n\nJA body.\n`,
    );
    const target = path.join(i18nDir, 'ja', '2024_01_01_first', 'index.md');
    assert.equal(readTargetHash(target), firstEntry.hash);

    // Stale: the English source changed after translation.
    writeFile(blogDir, '2024_01_01_first/index.md', `${first}\nUpdated.\n`);
    const refreshed = listSourceEntries(blogDir).find(
      (entry) => entry.slug === 'first',
    );
    assert.ok(refreshed);
    assert.notEqual(readTargetHash(target), refreshed.hash);

    // The second article has no translation in any locale.
    assert.deepEqual(
      availableLocalesForEntry('2024_02_01_second', i18nDir),
      [],
    );
    assert.deepEqual(availableLocalesForEntry('2024_01_01_first', i18nDir), [
      'ja',
    ]);
    assert.deepEqual(readTranslatedEntries('ko', i18nDir), new Set());
    assert.equal(
      contentEntryName('2024_01_01_first/index.md'),
      '2024_01_01_first',
    );
    assert.equal(secondEntry.content.includes('Body two.'), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

export async function testCollectionsKeepTranslationsSeparate() {
  const { collections } = await import('../../src/content.config.ts');
  assert.ok(collections.blog, 'the English blog collection must remain');
  assert.ok(collections.i18n, 'translations get their own collection');

  const image = () => z.any();
  const shapeOf = (collection: unknown) =>
    (
      collection as {
        schema: (context: unknown) => {
          shape: Record<string, unknown>;
          parse: (value: unknown) => unknown;
        };
      }
    ).schema({ image });
  const blogShape = shapeOf(collections.blog);
  const i18nShape = shapeOf(collections.i18n);

  for (const field of ['locale', 'sourceSlug', 'sourceHash']) {
    assert.ok(
      !(field in blogShape.shape),
      `blog schema must not gain ${field}`,
    );
    assert.ok(field in i18nShape.shape, `i18n schema must require ${field}`);
  }
  assert.throws(() => i18nShape.parse({ title: 'x' }));
}

export function testEnglishCorpusRoutesAreUnaffected() {
  const routes = readArticleRoutes(BLOG_CONTENT_DIR);
  assert.ok(routes.length > 50, 'the whole English corpus must be read');
  for (const route of routes) {
    assert.match(route.pathname, /^\/writing\//);
    assert.equal(
      LOCALES.some((locale) => route.pathname.startsWith(`/${locale.prefix}/`)),
      false,
      `${route.pathname} must never carry a locale prefix`,
    );
  }
}

export function testEnglishOnlySystemsNeverReferenceTranslations() {
  // RSS, search, related-post ranking, and distribution automation build from
  // the English collection or `src/content/blog` directly; a reference to the
  // translation store here would be a leak.
  const guarded = [
    'src/pages/rss.xml.ts',
    'src/pages/search-index.json.ts',
    'src/utils/text.ts',
    'src/utils/related-posts.ts',
    'scripts/automation/wait_for_deploy.py',
  ];
  for (const relative of guarded) {
    const content = fs.readFileSync(path.join(REPO_ROOT, relative), 'utf-8');
    assert.equal(
      content.includes('i18n'),
      false,
      `${relative} must not reference translations`,
    );
  }
  // The English data paths keep reading the 'blog' collection (directly or
  // through the injected getter); they never enumerate translations.
  for (const relative of [
    'src/pages/rss.xml.ts',
    'src/pages/search-index.json.ts',
    'src/utils/text.ts',
  ]) {
    const content = fs.readFileSync(path.join(REPO_ROOT, relative), 'utf-8');
    assert.ok(
      content.includes("'blog'"),
      `${relative} must keep reading the English blog collection`,
    );
  }
}

export function testEnglishSelectorVisibilityWithTranslations() {
  // An English article with a translation shows the selector (more than one
  // entry), with English current — so it stays available after switching back.
  const withTranslation = languageSelectorEntries({
    slug: 'kelly',
    currentCode: 'en',
    availableCodes: ['ja'],
  });
  assert.ok(
    withTranslation.length > 1,
    'the selector must appear on English pages that have translations',
  );
  assert.equal(withTranslation.find((entry) => entry.isCurrent)?.code, 'en');

  // An untranslated English article still shows no selector (single entry).
  assert.equal(
    languageSelectorEntries({
      slug: 'kelly',
      currentCode: 'en',
      availableCodes: [],
    }).length,
    1,
  );

  // Every localized page keeps the selector with itself current.
  for (const locale of LOCALES) {
    const entries = languageSelectorEntries({
      slug: 'kelly',
      currentCode: locale.code,
      availableCodes: [locale.code],
    });
    assert.ok(entries.length > 1, `${locale.code} page must keep the selector`);
    assert.equal(entries.find((entry) => entry.isCurrent)?.code, locale.code);
  }
}

export function testSelectorLabelsAndReciprocalNavigation() {
  const expectedLabels: Record<string, string> = {
    en: 'English',
    ja: '日本語',
    ko: '한국어',
    es: 'Español',
    'pt-BR': 'Português',
    fr: 'Français',
    'zh-Hans': '中文（简体）',
  };

  // The summary shows the current language, and each entry carries its own
  // language name — never a hardcoded English label.
  for (const locale of LOCALES) {
    const entries = languageSelectorEntries({
      slug: 'kelly',
      currentCode: locale.code,
      availableCodes: LOCALES.map((candidate) => candidate.code),
    });
    const labels = new Map(entries.map((entry) => [entry.code, entry.label]));
    for (const [code, label] of Object.entries(expectedLabels)) {
      assert.equal(labels.get(code), label, `${code} must label itself`);
    }
    assert.equal(
      entries.find((entry) => entry.isCurrent)?.label,
      expectedLabels[locale.code],
      `the ${locale.code} summary must read ${expectedLabels[locale.code]}`,
    );
  }

  // Navigation is reciprocal: each side links to the other's canonical URL,
  // and only versions that actually exist are listed.
  const english = languageSelectorEntries({
    slug: 'kelly',
    currentCode: 'en',
    availableCodes: ['ja', 'ko'],
  });
  const japanese = languageSelectorEntries({
    slug: 'kelly',
    currentCode: 'ja',
    availableCodes: ['ja', 'ko'],
  });
  assert.deepEqual(
    english.map((entry) => entry.code),
    ['en', 'ja', 'ko'],
  );
  const englishJaHref = english.find((entry) => entry.code === 'ja')?.href;
  const japaneseSelfHref = japanese.find((entry) => entry.code === 'ja')?.href;
  assert.ok(englishJaHref);
  assert.equal(japaneseSelfHref, englishJaHref);
  const japaneseEnHref = japanese.find((entry) => entry.code === 'en')?.href;
  assert.equal(
    japaneseEnHref,
    english.find((entry) => entry.code === 'en')?.href,
  );
  assert.equal(
    japanese.some((entry) => entry.code === 'fr'),
    false,
    'untranslated versions must not be listed',
  );
}

export function testSelectorLinksArePathOnlyWhileSeoUrlsStayAbsolute() {
  const origin = 'https://leonlins.com';

  // Selector links are internal navigation: path-only, so local/dev/preview
  // environments stay on the current origin instead of jumping to production.
  const entries = languageSelectorEntries({
    slug: 'kelly',
    currentCode: 'en',
    availableCodes: ['ja', 'pt-BR'],
  });
  assert.deepEqual(
    entries.map((entry) => entry.href),
    ['/writing/kelly', '/ja/writing/kelly', '/pt/writing/kelly'],
  );
  for (const entry of entries) {
    assert.equal(
      entry.href.startsWith('http'),
      false,
      `selector hrefs must not pin an origin (${entry.href})`,
    );
  }

  // Canonical, hreflang, and OG URLs stay absolute off SITE_URL.
  const links = buildHreflangLinks({
    siteOrigin: origin,
    slug: 'kelly',
    availableCodes: ['ja'],
  });
  assert.ok(links.length > 0);
  for (const link of links) {
    assert.equal(
      link.href.startsWith(`${origin}/`),
      true,
      `SEO URLs must stay absolute (${link.href})`,
    );
  }
}

export function testLocalizeRelatedPosts() {
  const related = [
    { slug: 'alpha', data: { title: 'Alpha', description: 'About alpha' } },
    { slug: 'beta', data: { title: 'Beta', description: 'About beta' } },
    { slug: 'gamma', data: { title: 'Gamma' } },
  ];
  const translations = new Map([
    ['beta', { title: 'ベータ', description: 'ベータについて' }],
    ['gamma', { title: 'ガンマ' }],
  ]);

  const localized = localizeRelatedPosts(related, translations);

  // Only posts with a translation in the current locale survive, in order,
  // carrying the localized title — never an English fallback title.
  assert.deepEqual(
    localized.map((post) => post.slug),
    ['beta', 'gamma'],
  );
  assert.equal(localized[0]?.data.title, 'ベータ');
  assert.equal(localized[0]?.data.description, 'ベータについて');
  assert.equal(localized[1]?.data.title, 'ガンマ');
  assert.equal(
    localized.every((post) => post.data.title !== 'Alpha'),
    true,
  );

  // The English selection is not mutated.
  assert.equal(related[1]?.data.title, 'Beta');

  // Nothing translated: the section has nothing to show and must be omitted.
  assert.deepEqual(localizeRelatedPosts(related, new Map()), []);
  assert.deepEqual(localizeRelatedPosts([], translations), []);
}

export function testDiscussionChromeCoversAllLocales() {
  const requiredKeys = [
    'heading',
    'invitation',
    'emptyState',
    'loadingState',
    'loadFailed',
    'unavailable',
    'nameLabel',
    'namePlaceholder',
    'bodyLabel',
    'bodyPlaceholder',
    'replyToPrefix',
    'commentFallback',
    'postButton',
    'postingButton',
    'cancelReply',
    'noticePosted',
    'noticeUpdated',
    'noticeDeleted',
    'authorBadge',
    'edited',
    'editLabel',
    'saveButton',
    'cancelButton',
    'replyButton',
    'editButton',
    'deleteButton',
    'deleteConfirm',
    'confirmDelete',
    'privatePrefix',
    'emailLabel',
  ];
  for (const locale of LOCALES) {
    const chrome = discussionChrome(locale.code);
    for (const key of requiredKeys) {
      assert.equal(
        typeof chrome[key as keyof typeof chrome],
        'string',
        `${locale.code} discussion chrome must define ${key}`,
      );
      assert.ok(
        chrome[key as keyof typeof chrome].trim(),
        `${locale.code} discussion chrome must not leave ${key} blank`,
      );
    }
  }

  // Spot-checks: the heading and primary action read natively, not English.
  assert.equal(discussionChrome('ja').heading, 'ディスカッション');
  assert.equal(discussionChrome('ja').postButton, '投稿する');
  assert.equal(discussionChrome('fr').postButton, 'Publier');
  assert.equal(discussionChrome('zh-Hans').replyButton, '回复');

  // Unknown locales fall back to the current English UI strings.
  const fallback = discussionChrome('xx');
  assert.equal(fallback.heading, 'Discussion');
  assert.equal(fallback.postButton, 'Post');
  assert.equal(fallback.emptyState, 'No comments yet. Add the first one.');
  assert.equal(discussionChrome().emailLabel, 'Email Leon');

  // Chrome carries no backend coupling: no slugs, endpoints, or error codes.
  const keys = Object.keys(discussionChrome('ja'));
  for (const forbidden of ['slug', 'endpoint', 'api', 'error']) {
    assert.equal(
      keys.some((key) => key.toLowerCase().includes(forbidden)),
      false,
      `discussion chrome must not carry backend concerns (${forbidden})`,
    );
  }
}

export function testNewsletterChromeCoversAllLocales() {
  const requiredKeys = [
    'title',
    'emailLabel',
    'emailPlaceholder',
    'subscribeButton',
    'successFull',
    'successCompact',
  ];
  for (const locale of LOCALES) {
    const chrome = newsletterChrome(locale.code);
    for (const key of requiredKeys) {
      assert.equal(
        typeof chrome[key as keyof typeof chrome],
        'string',
        `${locale.code} newsletter chrome must define ${key}`,
      );
      assert.ok(
        chrome[key as keyof typeof chrome].trim(),
        `${locale.code} newsletter chrome must not leave ${key} blank`,
      );
    }
  }

  // Spot-checks against native copy.
  assert.equal(newsletterChrome('ja').subscribeButton, '購読する');
  assert.equal(newsletterChrome('es').subscribeButton, 'Suscribirse');
  assert.equal(newsletterChrome('ko').emailPlaceholder, '이메일을 입력하세요');

  // Unknown locales fall back to the current English CTA copy.
  const fallback = newsletterChrome('xx');
  assert.equal(fallback.title, 'Get the next essay');
  assert.equal(fallback.emailLabel, 'Email address');
  assert.equal(fallback.emailPlaceholder, 'Enter your email');
  assert.equal(fallback.subscribeButton, 'Subscribe');

  // Chrome carries no subscription-backend coupling: no URLs or sources.
  const keys = Object.keys(newsletterChrome('ja'));
  for (const forbidden of ['action', 'url', 'source', 'endpoint']) {
    assert.equal(
      keys.some((key) => key.toLowerCase().includes(forbidden)),
      false,
      `newsletter chrome must not carry backend concerns (${forbidden})`,
    );
  }
}

/** Virtual clock: sleeps advance time instead of waiting, and are recorded. */
function makeVirtualClock() {
  let now = 0;
  const sleeps: number[] = [];
  return {
    sleeps,
    now: () => now,
    sleep: async (ms: number) => {
      sleeps.push(ms);
      now += ms;
    },
  };
}

function requestContents(options: { body: string }): string[] {
  const body = JSON.parse(options.body) as { contents?: unknown };
  assert.ok(Array.isArray(body.contents));
  assert.ok(body.contents.every((item) => typeof item === 'string'));
  return body.contents as string[];
}

function googleResponse(translations: string[]): string {
  return JSON.stringify({
    translations: translations.map((translatedText) => ({ translatedText })),
  });
}

function successFetch(prefix: string) {
  return (async (_url: unknown, options: { body: string }) => {
    const items = requestContents(options);
    return new Response(
      googleResponse(items.map((item) => `${prefix}:${item}`)),
      { headers: { 'content-type': 'application/json' } },
    );
  }) as unknown as typeof fetch;
}

const paceCredentials = {
  projectId: 'test-project',
  endpoint: 'https://example.invalid',
  getAccessToken: async () => 'test-token',
};

export async function testTranslationPacing() {
  const clock = makeVirtualClock();
  const throttle = new TranslationThrottle(clock);

  // A full minute's budget submits without waiting.
  await throttle.pace(TRANSLATOR_MAX_CHARS_PER_MINUTE);
  assert.deepEqual(clock.sleeps, []);

  // Anything beyond the budget waits for the rolling window to slide.
  await throttle.pace(1);
  assert.deepEqual(clock.sleeps, [60_000]);

  // Pacing is shared across requests: a second full budget waits again.
  await throttle.pace(TRANSLATOR_MAX_CHARS_PER_MINUTE);
  assert.deepEqual(clock.sleeps, [60_000, 60_000]);
}

export async function testTranslateTextsSharesPacing() {
  const clock = makeVirtualClock();
  const throttle = new TranslationThrottle(clock);
  const fetch = successFetch('TR');

  const first = await translateTexts(
    ['x'.repeat(MAX_CHUNK_CHARS)],
    'ja',
    paceCredentials,
    fetch,
    { throttle, sleep: clock.sleep },
  );
  assert.equal(first.length, 1);
  assert.deepEqual(clock.sleeps, []);

  await translateTexts(
    ['z'.repeat(MAX_CHUNK_CHARS)],
    'ja',
    paceCredentials,
    fetch,
    {
      throttle,
      sleep: clock.sleep,
    },
  );
  await translateTexts(['q'.repeat(5_000)], 'ja', paceCredentials, fetch, {
    throttle,
    sleep: clock.sleep,
  });
  const second = await translateTexts(['y'], 'ja', paceCredentials, fetch, {
    throttle,
    sleep: clock.sleep,
  });
  assert.deepEqual(second, ['TR:y']);
  assert.deepEqual(clock.sleeps, [60_000]);
  await assert.rejects(
    translateTexts(
      ['x'.repeat(MAX_CHUNK_CHARS + 1)],
      'ja',
      paceCredentials,
      fetch,
    ),
    /exceeds 10000 source characters/,
  );
}

export async function testTranslatorRetriesOn429() {
  const clock = makeVirtualClock();
  let calls = 0;
  const flaky = (async (_url: unknown, options: { body: string }) => {
    calls += 1;
    if (calls <= 2) return new Response('slow down', { status: 429 });
    const items = requestContents(options);
    return new Response(googleResponse(items.map((item) => `TR:${item}`)), {
      headers: { 'content-type': 'application/json' },
    });
  }) as unknown as typeof fetch;

  // The same request is retried rather than terminating immediately.
  const result = await translateTexts(['hello'], 'ja', paceCredentials, flaky, {
    sleep: clock.sleep,
  });
  assert.deepEqual(result, ['TR:hello']);
  assert.equal(calls, 3);
  assert.deepEqual(clock.sleeps, [2_000, 4_000]);
}

export async function testTranslatorHonorsRetryAfter() {
  const clock = makeVirtualClock();
  let calls = 0;
  const throttledOnce = (async () => {
    calls += 1;
    if (calls === 1) {
      return new Response('slow down', {
        status: 429,
        headers: { 'retry-after': '45' },
      });
    }
    return new Response(googleResponse(['TR:hello']), {
      headers: { 'content-type': 'application/json' },
    });
  }) as unknown as typeof fetch;

  const result = await translateTexts(
    ['hello'],
    'ja',
    paceCredentials,
    throttledOnce,
    { sleep: clock.sleep },
  );
  assert.deepEqual(result, ['TR:hello']);
  assert.deepEqual(clock.sleeps, [45_000]);
}

export async function testTranslatorGivesUpAfterBoundedRetries() {
  const clock = makeVirtualClock();
  let calls = 0;
  const alwaysThrottled = (async () =>
    new Response('slow down', { status: 429 })) as unknown as typeof fetch;
  const counting = (async (url: string | URL | Request, init?: RequestInit) => {
    calls += 1;
    return alwaysThrottled(url, init);
  }) as unknown as typeof fetch;

  await assert.rejects(
    translateTexts(['hello'], 'ja', paceCredentials, counting, {
      sleep: clock.sleep,
    }),
    /HTTP 429.*throttl.*No files were modified/s,
  );
  // One initial attempt plus a small bounded number of retries.
  assert.equal(calls, 1 + TRANSLATOR_MAX_RETRIES);
  assert.deepEqual(clock.sleeps, [2_000, 4_000, 8_000, 16_000, 32_000]);
}

export async function runI18nTests() {
  testLocaleDefinitions();
  testHreflangLinks();
  testLanguageSelectorEntries();
  testEnglishSelectorVisibilityWithTranslations();
  testSelectorLabelsAndReciprocalNavigation();
  testSelectorLinksArePathOnlyWhileSeoUrlsStayAbsolute();
  testLocalizeRelatedPosts();
  testDiscussionChromeCoversAllLocales();
  testNewsletterChromeCoversAllLocales();
  testArticleChromeDefaultsToEnglish();
  testLocalizedSitemapLastmod();
  testSourceHashIsDeterministic();
  testProtectRestoreRoundTrip();
  testSplitIntoChunksKeepsPlaceholdersWhole();
  testMarkdownValidationSeverities();
  await testSyntaxAwareMarkdownTranslation();
  await testTextNodeMappingAndEmptyResult();
  await testTranslatedProseEscapesMarkdownSyntax();
  await testLongArticleChunksAndAtomicFailure();
  testFailedChunkDoesNotWriteArticle();
  testComposeTranslatedFile();
  testTranslationsReuseCanonicalAssets();
  testMissingCredentialsFailClearly();
  await testGoogleTranslationRequestAndResponse();
  await testTranslatorFailureModifiesNothing();
  await testTranslationPacing();
  await testTranslateTextsSharesPacing();
  await testTranslatorRetriesOn429();
  await testTranslatorHonorsRetryAfter();
  await testTranslatorGivesUpAfterBoundedRetries();
  testTranslationStatusClassification();
  await testCollectionsKeepTranslationsSeparate();
  testEnglishCorpusRoutesAreUnaffected();
  testEnglishOnlySystemsNeverReferenceTranslations();
}
