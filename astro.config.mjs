// @ts-check
import mdx from "@astrojs/mdx";
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import remarkFootnotes from "remark-footnotes"; // ✅ add plugin
import { SITE_URL } from "./src/consts.ts";

export default defineConfig({
  site: SITE_URL,
  integrations: [
    sitemap({
      // Add last modified dates if available
      serialize(item) {
        // Check for updatedDate or fallback to published date
        const lastmod = item.data?.updatedDate || item.data?.pubDate;
        return {
          ...item,
          lastmod: lastmod ? new Date(lastmod).toISOString() : undefined,
        };
      },
    }),
    mdx(),
  ],
  markdown: {
    remarkPlugins: [
      [remarkFootnotes, { inlineNotes: true }], // enable footnotes
    ],
  },
});
