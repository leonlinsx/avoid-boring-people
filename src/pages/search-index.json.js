
// src/pages/search-index.json.js
import { getCollection } from "astro:content";

export async function GET() {
  const posts = await getCollection("blog");

  const index = posts.map((post) => ({
    title: post.data.title,
    link: `/writing/${post.slug}/`,
    // Strip markdown/HTML from body if you want plain text
    content: post.body,
    date: post.data.pubDate ? post.data.pubDate.toISOString() : null,
  }));

  return new Response(JSON.stringify(index), {
    headers: {
      "Content-Type": "application/json",
    },
  });
}
