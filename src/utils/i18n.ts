// Minimal multilingual article support: locale table, hreflang/SEO helpers,
// translation-index reader, and the deterministic source hash used by the
// translation CLI. English (`src/content/blog`) stays the only source of
// truth; generated files live under `src/content/i18n` and never enter the
// English blog collection, RSS, search, related posts, or distribution.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface LocaleDef {
  /** BCP44/BCP47 code used for `hreflang`, `<html lang>`, and directory names. */
  code: 'ja' | 'ko' | 'es' | 'pt-BR' | 'fr' | 'zh-Hans';
  /** Short URL prefix: `/<prefix>/writing/<slug>`. */
  prefix: 'ja' | 'ko' | 'es' | 'pt' | 'fr' | 'zh';
  /** Azure Translator target language. */
  translatorTarget: string;
  /** Own-language display name (no flags, no icons). */
  label: string;
  /** Open Graph locale for the translated page. */
  ogLocale: string;
  /** `Intl` locale for dates on the translated page. */
  dateLocale: string;
}

export const LOCALES: LocaleDef[] = [
  {
    code: 'ja',
    prefix: 'ja',
    translatorTarget: 'ja',
    label: '日本語',
    ogLocale: 'ja_JP',
    dateLocale: 'ja-JP',
  },
  {
    code: 'ko',
    prefix: 'ko',
    translatorTarget: 'ko',
    label: '한국어',
    ogLocale: 'ko_KR',
    dateLocale: 'ko-KR',
  },
  {
    code: 'es',
    prefix: 'es',
    translatorTarget: 'es',
    label: 'Español',
    ogLocale: 'es_ES',
    dateLocale: 'es-ES',
  },
  {
    code: 'pt-BR',
    prefix: 'pt',
    translatorTarget: 'pt',
    label: 'Português',
    ogLocale: 'pt_BR',
    dateLocale: 'pt-BR',
  },
  {
    code: 'fr',
    prefix: 'fr',
    translatorTarget: 'fr',
    label: 'Français',
    ogLocale: 'fr_FR',
    dateLocale: 'fr-FR',
  },
  {
    code: 'zh-Hans',
    prefix: 'zh',
    translatorTarget: 'zh-Hans',
    label: '中文（简体）',
    ogLocale: 'zh_CN',
    dateLocale: 'zh-CN',
  },
];

export const ENGLISH = {
  code: 'en',
  label: 'English',
  ogLocale: 'en_US',
  dateLocale: 'en-US',
} as const;

export function localeByCode(code: string): LocaleDef | undefined {
  return LOCALES.find((locale) => locale.code === code);
}

export function localeByPrefix(prefix: string): LocaleDef | undefined {
  return LOCALES.find((locale) => locale.prefix === prefix);
}

/**
 * Directory that owns generated translations (never the English collection).
 * Anchored at the process working directory (the repo root for builds, dev,
 * tests, and CLIs) rather than the module file: Astro bundles article
 * components for SSR, so a file-relative path would point into `dist/`.
 */
export const I18N_CONTENT_DIR = path.resolve(process.cwd(), 'src/content/i18n');

/** Canonical pathname of the English article. */
export function englishPathname(slug: string): string {
  return `/writing/${slug}`;
}

/** Canonical pathname of a translated article. */
export function localizedPathname(prefix: string, slug: string): string {
  return `/${prefix}/writing/${slug}`;
}

/**
 * Strip a locale prefix (`/ja/writing/x` -> `/writing/x`) so sitemap lastmod
 * lookups reuse the English article's date. Non-localized paths pass through.
 */
export function stripLocalePrefix(pathname: string): string {
  for (const locale of LOCALES) {
    const prefix = `/${locale.prefix}/`;
    if (pathname === `/${locale.prefix}`) return '/';
    if (pathname.startsWith(prefix)) return pathname.slice(prefix.length - 1);
  }
  return pathname;
}

export interface HreflangLink {
  hrefLang: string;
  href: string;
}

/**
 * Reciprocal hreflang for the versions that actually exist, plus `x-default`
 * pointing at English. Unknown locale codes are ignored.
 */
export function buildHreflangLinks(options: {
  siteOrigin: string;
  slug: string;
  availableCodes: string[];
}): HreflangLink[] {
  const { siteOrigin, slug, availableCodes } = options;
  const origin = siteOrigin.replace(/\/+$/, '');
  const englishHref = `${origin}${englishPathname(slug)}`;
  const links: HreflangLink[] = [{ hrefLang: 'en', href: englishHref }];
  for (const code of availableCodes) {
    const locale = localeByCode(code);
    if (!locale) continue;
    if (links.some((link) => link.hrefLang === locale.code)) continue;
    links.push({
      hrefLang: locale.code,
      href: `${origin}${localizedPathname(locale.prefix, slug)}`,
    });
  }
  links.push({ hrefLang: 'x-default', href: englishHref });
  return links;
}

export interface LanguageEntry {
  code: string;
  label: string;
  href: string;
  isCurrent: boolean;
}

/**
 * Language-selector entries: English plus every translation that exists for
 * this slug. Hrefs are path-only internal navigation, so local/dev/preview
 * environments stay on the current origin. The component hides itself when
 * only one entry is returned.
 */
export function languageSelectorEntries(options: {
  slug: string;
  currentCode: string;
  availableCodes: string[];
}): LanguageEntry[] {
  const { slug, currentCode, availableCodes } = options;
  const entries: LanguageEntry[] = [
    {
      code: ENGLISH.code,
      label: ENGLISH.label,
      href: englishPathname(slug),
      isCurrent: currentCode === ENGLISH.code,
    },
  ];
  const seen = new Set<string>([ENGLISH.code]);
  for (const code of availableCodes) {
    const locale = localeByCode(code);
    if (!locale || seen.has(locale.code)) continue;
    seen.add(locale.code);
    entries.push({
      code: locale.code,
      label: locale.label,
      href: localizedPathname(locale.prefix, slug),
      isCurrent: currentCode === locale.code,
    });
  }
  if (currentCode !== ENGLISH.code && !seen.has(currentCode)) {
    const locale = localeByCode(currentCode);
    if (locale) {
      entries.push({
        code: locale.code,
        label: locale.label,
        href: localizedPathname(locale.prefix, slug),
        isCurrent: true,
      });
    }
  }
  return entries;
}

export interface ArticleChrome {
  minReadUnit: string;
  lastUpdated: string;
  relatedPosts: string;
  home: string;
  writing: string;
}

const ENGLISH_CHROME: ArticleChrome = {
  minReadUnit: 'min read',
  lastUpdated: 'Last updated on',
  relatedPosts: 'Related Posts',
  home: 'Home',
  writing: 'Writing',
};

const CHROME_BY_LOCALE: Record<string, ArticleChrome> = {
  ja: {
    minReadUnit: '分で読めます',
    lastUpdated: '最終更新',
    relatedPosts: '関連記事',
    home: 'ホーム',
    writing: '記事',
  },
  ko: {
    minReadUnit: '분 읽기',
    lastUpdated: '마지막 업데이트',
    relatedPosts: '관련 글',
    home: '홈',
    writing: '글',
  },
  es: {
    minReadUnit: 'min de lectura',
    lastUpdated: 'Última actualización',
    relatedPosts: 'Artículos relacionados',
    home: 'Inicio',
    writing: 'Artículos',
  },
  'pt-BR': {
    minReadUnit: 'min de leitura',
    lastUpdated: 'Última atualização em',
    relatedPosts: 'Artigos relacionados',
    home: 'Início',
    writing: 'Artigos',
  },
  fr: {
    minReadUnit: 'min de lecture',
    lastUpdated: 'Dernière mise à jour le',
    relatedPosts: 'Articles similaires',
    home: 'Accueil',
    writing: 'Articles',
  },
  'zh-Hans': {
    minReadUnit: '分钟阅读',
    lastUpdated: '最后更新',
    relatedPosts: '相关文章',
    home: '首页',
    writing: '文章',
  },
};

/** Small article-reading chrome strings; English is the fallback. */
export function articleChrome(code?: string): ArticleChrome {
  if (code && CHROME_BY_LOCALE[code]) return CHROME_BY_LOCALE[code];
  return ENGLISH_CHROME;
}

/**
 * Deterministic hash of the English source file. Line endings are normalized
 * so the same content hashes identically across platforms.
 */
export function computeSourceHash(content: string): string {
  return crypto
    .createHash('sha256')
    .update(content.replace(/\r\n/g, '\n'), 'utf-8')
    .digest('hex');
}

/**
 * English content-directory names that have a translation for `code`:
 * `src/content/i18n/<code>/<entry>/index.md`.
 */
export function readTranslatedEntries(
  code: string,
  i18nDir: string = I18N_CONTENT_DIR,
): Set<string> {
  const entries = new Set<string>();
  let dirs: string[];
  try {
    dirs = fs.readdirSync(path.join(i18nDir, code));
  } catch {
    return entries;
  }
  for (const entry of dirs) {
    try {
      if (fs.existsSync(path.join(i18nDir, code, entry, 'index.md'))) {
        entries.add(entry);
      }
    } catch {
      // Ignore unreadable entries; status/route building skips them.
    }
  }
  return entries;
}

/** Locale codes that have a translation for an English content entry. */
export function availableLocalesForEntry(
  entry: string,
  i18nDir: string = I18N_CONTENT_DIR,
): string[] {
  return LOCALES.map((locale) => locale.code).filter((code) =>
    readTranslatedEntries(code, i18nDir).has(entry),
  );
}

/** Content-directory name for a blog collection id (`<entry>/index.md`). */
export function contentEntryName(id: string): string {
  return id.replace(/\/index\.(md|mdx)$/i, '');
}

export interface RelatedTranslation {
  title: string;
  description?: string;
}

/**
 * Narrow the English related-post selection to posts that have a translation
 * in the current locale, carrying the localized title/description. Order is
 * preserved and the English selection is never mutated, so the existing
 * ranking system is reused untouched. An empty result means the Related Posts
 * section is omitted entirely — never an English fallback.
 */
export function localizeRelatedPosts<
  T extends { slug: string; data: { title: string; description?: string } },
>(related: T[], translationsBySlug: Map<string, RelatedTranslation>): T[] {
  const localized: T[] = [];
  for (const post of related) {
    const translation = translationsBySlug.get(post.slug);
    if (!translation) continue;
    // Same post shape with reading strings swapped; the cast is safe because
    // only `title`/`description` change and both keep their declared types.
    localized.push({
      ...post,
      data: {
        ...post.data,
        title: translation.title,
        description: translation.description ?? post.data.description,
      },
    } as T);
  }
  return localized;
}

export {
  discussionChrome,
  newsletterChrome,
  type DiscussionChrome,
  type NewsletterChrome,
} from './locale-chrome.ts';
