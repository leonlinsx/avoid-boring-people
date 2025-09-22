import { getCollection, type CollectionEntry } from 'astro:content';
import readingTime from 'reading-time';
import type { ImageMetadata } from 'astro';
import { getCleanSlug } from './slug';

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
 * Normalize heroImage field to either ImageMetadata or string URL
 */
function normalizeHeroImage(
  heroImage: unknown,
  postId: string,
): ImageMetadata | string | undefined {
  if (!heroImage) return undefined;

  // If it's already an Astro ImageMetadata object
  if (
    typeof heroImage === 'object' &&
    heroImage !== null &&
    'src' in heroImage &&
    'width' in heroImage &&
    'height' in heroImage &&
    'format' in heroImage
  ) {
    return heroImage as ImageMetadata;
  }

  // If it's a string path (e.g., "./ergo_5.webp")
  if (typeof heroImage === 'string') {
    // Resolve relative paths against the post folder
    if (heroImage.startsWith('./') || heroImage.startsWith('../')) {
      // Example: "blog/2021_04_03_ergodicity/index.md" → "blog/2021_04_03_ergodicity/"
      const baseDir = postId.replace(/\/index\.md$/, '').replace(/\.md$/, '');
      return `/${baseDir}/${heroImage.replace(/^\.\//, '')}`;
    }
    // Otherwise assume it's already a valid path (e.g., "/images/foo.webp")
    return heroImage;
  }

  return undefined;
}

/**
 * Paginate all posts, with categories list.
 */
export async function getAllPostsPaginated(paginate: PaginateFn, pageSize = 8) {
  const allPosts = await getCollection('blog');

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
  const all = await getCollection('blog');

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
