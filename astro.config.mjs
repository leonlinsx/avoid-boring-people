// @ts-check
import mdx from "@astrojs/mdx";
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import remarkFootnotes from "remark-footnotes";
import { SITE_URL } from "./src/consts.ts";

export default defineConfig({
  site: SITE_URL,
  integrations: [
    sitemap({
      // Simplified: SitemapItem has no .data, so just return lastmod = now
      serialize(item) {
        return {
          ...item,
          lastmod: new Date().toISOString(),
        };
      },
    }),
    mdx(),
  ],
  markdown: {
    // @ts-expect-error - remarkFootnotes typing mismatch
    remarkPlugins: [[remarkFootnotes, { inlineNotes: true }]],
  },

  // ✅ Redirects must be an object
  redirects: {
    "/writing": "/writing/1",
    "/writing/category/:category": "/writing/category/:category/1",
    '/newsletter': '/#subscribe',
  },
});
