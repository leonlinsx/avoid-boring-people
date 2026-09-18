// @ts-check
import mdx from '@astrojs/mdx';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import remarkFootnotes from 'remark-footnotes';
import { SITE_URL } from './src/consts.ts';
import preact from '@astrojs/preact';
import vercel from '@astrojs/vercel';
import { visualizer } from 'rollup-plugin-visualizer';
import { newsletterAssets } from './src/integrations/newsletter-assets.ts';
import {
  buildBlogLastmodMap,
  buildLegacyArticleRedirects,
  serializeSitemapItem,
} from './src/utils/article-routes.ts';

// Blog lastmod comes from each article's updatedDate/pubDate at build time, so
// the sitemap never needs `new Date()`.
const blogLastmod = buildBlogLastmodMap();

export default defineConfig({
  site: SITE_URL,
  // Canonical URLs and sitemap entries never carry a trailing slash. Asking the
  // adapter to normalize them (it forwards this to the deployed router) also
  // makes `/writing/2020_12_02_kelly/` reach the slashless legacy redirect key
  // below, which is the only form a redirect route can match.
  trailingSlash: 'never',
  // Replaced by src/middleware.ts with equivalent checks except the signed SNS POST.
  security: { checkOrigin: false },
  adapter: vercel(),
  integrations: [
    sitemap({
      filter(page) {
        const pathname = new URL(page).pathname;
        // Exclude search (noindex), tokens (noindex), and api endpoints
        return (
          !pathname.startsWith('/api/') &&
          pathname !== '/writing/search/' &&
          pathname !== '/writing/search' &&
          pathname !== '/tokens/' &&
          pathname !== '/tokens'
        );
      },
      serialize(item) {
        return serializeSitemapItem(item, blogLastmod);
      },
    }),
    mdx(),
    preact(),
    newsletterAssets(),
  ],
  markdown: {
    // @ts-expect-error - remarkFootnotes typing mismatch
    remarkPlugins: [[remarkFootnotes, { inlineNotes: true }]],
  },

  // ✅ Redirects must be an object
  redirects: {
    // Legacy date-prefixed article paths (/writing/2020_12_02_kelly/) that are
    // still linked from imported articles and the wild.
    ...buildLegacyArticleRedirects(),
    '/writing': { destination: '/writing/1', status: 308 },
    '/writing/category/:category': {
      destination: '/writing/category/:category/1',
      status: 308,
    },
    '/newsletter': '/#subscribe',
  },

  vite: {
    plugins: [
      visualizer({
        filename: 'dist/stats.html',
        template: 'treemap', // or 'sunburst', 'network'
      }),
    ],
  },
});
