import { getCollection } from 'astro:content';
import rss from '@astrojs/rss';
import { SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from '../consts.ts';
import { getCleanSlug } from '../utils/slug.ts';

export async function GET(): Promise<Response> {
  const posts = await getCollection('blog');

  return rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: SITE_URL,
    items: posts.map((post) => {
      // fallback to post.id if slug isn’t available
      const slug = getCleanSlug(post);
      return {
        title: post.data.title,
        description: post.data.description,
        pubDate: post.data.pubDate,
        link: `/writing/${slug}/`,
      };
    }),
  });
}
