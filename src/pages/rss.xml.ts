import { getCollection } from 'astro:content';
import rss from '@astrojs/rss';
import {
  SITE_AUTHOR,
  SITE_DESCRIPTION,
  SITE_TITLE,
  SITE_URL,
} from '../consts.ts';
import { articleHeroUrl } from '../utils/hero.ts';
import { enrichPost } from '../utils/text.ts';

const DESCRIPTION_MAX = 500;

function xml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function imageType(url: string): string {
  const extension = new URL(url).pathname.split('.').pop()?.toLowerCase();
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'png') return 'image/png';
  if (extension === 'gif') return 'image/gif';
  if (extension === 'avif') return 'image/avif';
  return 'image/webp';
}

function plainText(markdown: string): string {
  return markdown
    .replace(/^---[\s\S]*?---/m, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_`~|-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function rssDescription(
  description: string | undefined,
  body: string,
): string {
  const written = plainText(description ?? '');
  const source = plainText(body);
  if (written.length >= 300 || !source) return written;
  const combined = source.toLowerCase().startsWith(written.toLowerCase())
    ? source
    : [written, source].filter(Boolean).join(' ');
  if (combined.length <= DESCRIPTION_MAX) return combined;
  const clipped = combined.slice(0, DESCRIPTION_MAX + 1);
  const boundary = clipped.lastIndexOf(' ');
  return `${clipped.slice(0, boundary >= 300 ? boundary : DESCRIPTION_MAX).trimEnd()}…`;
}

export async function GET(): Promise<Response> {
  const posts = (await getCollection('blog'))
    .map(enrichPost)
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

  const items = await Promise.all(
    posts.map(async (post) => {
      const canonical = new URL(`/writing/${post.slug}/`, SITE_URL).toString();
      const image = await articleHeroUrl(post.data.heroImage);
      const mime = image ? imageType(image) : undefined;
      return {
        title: post.data.title,
        description: rssDescription(post.data.description, post.body ?? ''),
        pubDate: post.data.pubDate,
        link: canonical,
        customData: [
          `<guid isPermaLink="true">${xml(canonical)}</guid>`,
          `<dc:creator>${xml(SITE_AUTHOR)}</dc:creator>`,
          `<category>${xml(post.data.category)}</category>`,
          image ? `<enclosure url="${xml(image)}" type="${mime}" />` : '',
          image
            ? `<media:content url="${xml(image)}" medium="image" type="${mime}" />`
            : '',
        ].join(''),
      };
    }),
  );

  return rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: SITE_URL,
    xmlns: {
      dc: 'http://purl.org/dc/elements/1.1/',
      media: 'http://search.yahoo.com/mrss/',
    },
    customData: '<language>en</language>',
    items,
  });
}
