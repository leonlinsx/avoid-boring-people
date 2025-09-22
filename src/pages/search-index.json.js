
/* global Response */
// src/pages/search-index.json.js
// src/pages/search-index.json.js
import { getCollection } from "astro:content";

export async function GET() {
  const posts = await getCollection("blog");

  const index = posts.map((post) => ({
    id: post.id,
    title: post.data.title,
    url: `/writing/${post.slug}/`,
    date: post.data.pubDate ? post.data.pubDate.toISOString() : null,
    content: post.body, // raw markdown
    category: post.data.category, // ✅ include category
    tags: post.data.tags || [],   // ✅ include tags
  }));

  return new Response(JSON.stringify(index), {
    headers: {
      "Content-Type": "application/json",
    },
  });
}
