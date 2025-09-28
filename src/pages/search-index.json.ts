/* global Response */
// src/pages/search-index.json.ts
import { getCollection } from 'astro:content';
import { getCleanSlug } from '../utils/slug.ts';

export async function GET(): Promise<Response> {
  const posts = await getCollection('blog');

  const index = posts.map((post) => ({
    id: post.id,
    title: post.data.title,
    url: `/writing/${getCleanSlug(post)}/`,
    date: post.data.pubDate ? post.data.pubDate.toISOString() : null,
    content: post.body, // raw markdown
    category: post.data.category, // ✅ include category
    tags: post.data.tags || [], // ✅ include tags
  }));

  return new Response(JSON.stringify(index), {
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
