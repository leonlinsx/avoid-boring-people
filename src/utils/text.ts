import { getCollection } from "astro:content";
import readingTime from "reading-time";
import type { CollectionEntry } from "astro:content";

export type BlogPost = CollectionEntry<"blog"> & {
  slug: string;
  data: CollectionEntry<"blog">["data"] & {
    category: string;
    readingTime: number;
  };
};

export type PaginateFn = <T>(items: T[], options: { pageSize: number; params?: Record<string, any> }) => Array<any>;

export const titleCase = (s: string) =>
  (s ?? "").toString().replace(
    /\w\S*/g,
    (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  );

export const normalizeCategory = (s: string) =>
  (s ?? "").toString().trim().toLowerCase();

export async function getAllPostsPaginated(paginate: PaginateFn, pageSize = 8) {
  const allPosts = await getCollection("blog");
  const categories = Array.from(
    new Set(allPosts.map((p) => normalizeCategory(p.data.category ?? "")))
  )
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  const posts: BlogPost[] = allPosts
    .map((p) => ({
      ...p,
      slug: p.id.replace(/\.md$/, ""),
      data: {
        ...p.data,
        category: p.data.category?.trim() || "",
        readingTime: Math.max(1, Math.round(readingTime(p.body ?? "").minutes)),
      },
    }))
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

  const pages = paginate(posts, { pageSize });

  return { pages, categories };
}

export async function getCategoryPostsPaginated(paginate: PaginateFn, pageSize = 8) {
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
      .map((p) => ({
        ...p,
        slug: p.id.replace(/\.md$/, ""),
        data: {
          ...p.data,
          category: p.data.category?.trim() || "",
          readingTime: Math.max(1, Math.round(readingTime(p.body ?? "").minutes)),
        },
      }))
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
