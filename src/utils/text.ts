import type { CollectionEntry } from 'astro:content';
import readingTime from 'reading-time';
import { getCleanSlug } from './slug.ts';
import type { ImageMetadata } from 'astro';
import { normalizeHeroImage } from './hero.ts';

export type BlogPost = CollectionEntry<'blog'> & {
  slug: string;
  data: CollectionEntry<'blog'>['data'] & {
    category: string;
    categoryNormalized: string;
    readingTime: number;
    tags: string[];
    // ✅ supports both Astro-processed images and string paths
    heroImage?: ImageMetadata | string;
  };
};

export type PaginateFn = <T>(
  items: T[],
  options: { pageSize: number; params?: Record<string, any> },
) => Array<any>;

type GetCollectionFn = <CollectionName extends string = string>(
  collection: CollectionName,
) => Promise<CollectionEntry<CollectionName>[]>;

/**
 * Convert a string to Title Case.
 */
export const titleCase = (s: string) =>
  (s ?? '')
    .toString()
    .replace(
      /\w\S*/g,
      (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
    );

/**
 * Normalize categories to lowercase, trimmed.
 */
export const normalizeCategory = (s: string) =>
  (s ?? '').toString().trim().toLowerCase();

/**
 * Ensure every post has slug, normalized category, and readingTime.
 */
export function enrichPost(p: CollectionEntry<'blog'>): BlogPost {
  const slug = getCleanSlug(p);

  return {
    ...p,
    slug,
    data: {
      ...p.data,
      category: p.data.category?.trim() || '',
      categoryNormalized: normalizeCategory(p.data.category ?? ''),
      readingTime: Math.max(1, Math.round(readingTime(p.body ?? '').minutes)),
      tags: Array.isArray(p.data.tags) ? p.data.tags : [],
      heroImage: normalizeHeroImage(p.data.heroImage, p.id),
    },
  };
}

/**
 * Paginate all posts, with categories list.
 */
let getCollectionImpl: GetCollectionFn | null = null;

async function resolveGetCollection(): Promise<GetCollectionFn> {
  if (getCollectionImpl) {
    return getCollectionImpl;
  }

  try {
    const mod = await import('astro:content');
    const actual = (mod as { getCollection?: GetCollectionFn }).getCollection;
    if (actual) {
      getCollectionImpl = actual;
      return actual;
    }
  } catch (error) {
    // Ignore, we'll throw a more helpful message below.
  }

  throw new Error(
    'Unable to load astro:content getCollection. Provide a test implementation using setGetCollectionImplementation.',
  );
}

/**
 * Allow tests to swap out the getCollection implementation.
 * In production this stays pointed at Astro's runtime implementation.
 */
export function setGetCollectionImplementation(replacement: GetCollectionFn | null) {
  getCollectionImpl = replacement;
}

export async function getAllPostsPaginated(paginate: PaginateFn, pageSize = 8) {
  const getter = await resolveGetCollection();
  const allPosts = await getter('blog');

  const categories = Array.from(
    new Set(allPosts.map((p) => normalizeCategory(p.data.category ?? ''))),
  )
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  const posts: BlogPost[] = allPosts
    .map(enrichPost)
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

  const pages = paginate(posts, { pageSize });

  return { pages, categories };
}

/**
 * Paginate posts by category.
 */
export async function getCategoryPostsPaginated(
  paginate: PaginateFn,
  pageSize = 8,
) {
  const getter = await resolveGetCollection();
  const all = await getter('blog');

  const categories = Array.from(
    new Set(all.map((p) => normalizeCategory(p.data.category ?? ''))),
  )
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  const routes: any[] = [];

  for (const category of categories) {
    const filtered: BlogPost[] = all
      .filter((p) => normalizeCategory(p.data.category ?? '') === category)
      .map(enrichPost)
      .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

    const pages = paginate(filtered, {
      pageSize,
      params: { category },
    });

    routes.push(
      ...pages.map((pg: any) => ({
        ...pg,
        props: {
          ...(pg.props || {}),
          categories,
          activeCategory: category,
        },
      })),
    );
  }

  return routes;
}
