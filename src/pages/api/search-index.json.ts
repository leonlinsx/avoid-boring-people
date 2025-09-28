import { getCollection } from 'astro:content';

export async function GET(): Promise<Response> {
  const posts = await getCollection('blog');

  // Map down to just what Fuse.js needs
  const index = posts.map((post) => ({
    slug: post.slug ?? post.id.replace(/\.md$/, ''),
    title: post.data.title,
    description: post.data.description || '',
    category: post.data.category || '',
    tags: post.data.tags || [],
    pubDate: post.data.pubDate,
    heroImage:
      typeof post.data.heroImage === 'string'
        ? post.data.heroImage
        : post.data.heroImage?.src || null,
  }));

  return new Response(JSON.stringify(index), {
    headers: { 'Content-Type': 'application/json' },
  });
}
