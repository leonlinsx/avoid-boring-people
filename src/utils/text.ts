import { getCollection, type CollectionEntry } from "astro:content";
import readingTime from "reading-time";

export type BlogPost = CollectionEntry<"blog"> & {
  slug: string;
  data: CollectionEntry<"blog">["data"] & {
    category: string;
    readingTime: number; // guaranteed after enrichment
  };
};

export type PaginateFn = <T>(
  items: T[],
  options: { pageSize: number; params?: Record<string, any> }
) => Array<any>;

/**
 * Convert a string to Title Case.
 */
export const titleCase = (s: string) =>
  (s ?? "").toString().replace(
    /\w\S*/g,
    (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  );

/**
 * Normalize categories to lowercase, trimmed.
 */
export const normalizeCategory = (s: string) =>
  (s ?? "").toString().trim().toLowerCase();

/**
 * Ensure every post has slug, normalized category, and readingTime.
 */
export function enrichPost(p: CollectionEntry<"blog">): BlogPost {
  return {
    ...p,
    slug: p.id.replace(/\.md$/, ""),
    data: {
      ...p.data,
      category: p.data.category?.trim() || "",
      readingTime: Math.max(
        1,
        Math.round(readingTime(p.body ?? "").minutes)
      ),
    },
  };
}

/**
 * Paginate all posts, with categories list.
 */
export async function getAllPostsPaginated(
  paginate: PaginateFn,
  pageSize = 8
) {
  const allPosts = await getCollection("blog");

  const categories = Array.from(
    new Set(allPosts.map((p) => normalizeCategory(p.data.category ?? "")))
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
  pageSize = 8
) {
  const all = await getCollection("blog");

  const categories = Array.from(
    new Set(all.map((p) => normalizeCategory(p.data.category ?? "")))
  )
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  const routes: any[] = [];

  for (const category of categories) {
    const filtered: BlogPost[] = all
      .filter((p) => normalizeCategory(p.data.category ?? "") === category)
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
      }))
    );
  }

  return routes;
}
