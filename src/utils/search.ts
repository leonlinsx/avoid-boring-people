import type { BlogPost } from './text';

function normalizeQuery(query: string): string {
  return query
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Filter posts on the server to match the client-side Fuse.js behaviour.
 * Ensures the search page returns relevant results even when JavaScript is disabled.
 */
export function searchPosts(posts: BlogPost[], query: string): BlogPost[] {
  const normalizedQuery = normalizeQuery(query);
  if (!normalizedQuery) {
    return posts;
  }

  const terms = normalizedQuery.split(' ').filter(Boolean);

  return posts.filter((post) => {
    const haystack = [
      post.data.title,
      post.data.description,
      post.data.category,
      ...(post.data.tags ?? []),
      post.body,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return terms.every((term) => haystack.includes(term));
  });
}

export { normalizeQuery };
