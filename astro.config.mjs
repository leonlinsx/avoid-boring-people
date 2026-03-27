// @ts-check
import mdx from '@astrojs/mdx';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import remarkFootnotes from 'remark-footnotes';
import { SITE_URL } from './src/consts.ts';
import preact from '@astrojs/preact';
import { visualizer } from 'rollup-plugin-visualizer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Build a map of blog post URL pathname → ISO lastmod date.
 * Reads frontmatter from each index.md at build time to avoid using new Date().
 */
function buildBlogLastmodMap() {
  const blogDir = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    'src/content/blog',
  );
  /** @type {Record<string, string>} */
  const map = {};
  try {
    const entries = fs.readdirSync(blogDir);
    for (const entry of entries) {
      const mdPath = path.join(blogDir, entry, 'index.md');
      if (!fs.existsSync(mdPath)) continue;
      const content = fs.readFileSync(mdPath, 'utf-8');
      // Parse updatedDate first, fall back to pubDate
      const updatedMatch = content.match(/^updatedDate:\s*(\S+)/m);
      const pubMatch = content.match(/^pubDate:\s*(\S+)/m);
      const slugOverride = content.match(/^slug:\s*(\S+)/m);
      const dateStr = updatedMatch?.[1] ?? pubMatch?.[1];
      if (!dateStr) continue;
      const slug = slugOverride
        ? slugOverride[1]
        : entry.replace(/^\d{4}_\d{2}_\d{2}_/, '');
      map[`/writing/${slug}/`] = new Date(dateStr).toISOString();
    }
  } catch {
    // non-fatal: fall through to static fallback
  }
  return map;
}

const blogLastmod = buildBlogLastmodMap();
// Stable fallback date for non-blog static pages (site launch / last major update)
const STATIC_LASTMOD = '2025-01-01T00:00:00.000Z';

export default defineConfig({
  site: SITE_URL,
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
        const pathname = new URL(item.url).pathname;
        return {
          ...item,
          lastmod: blogLastmod[pathname] ?? STATIC_LASTMOD,
        };
      },
    }),
    mdx(),
    preact(),
  ],
  markdown: {
    // @ts-expect-error - remarkFootnotes typing mismatch
    remarkPlugins: [[remarkFootnotes, { inlineNotes: true }]],
  },

  // ✅ Redirects must be an object
  redirects: {
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
