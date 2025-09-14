// @ts-check
import mdx from "@astrojs/mdx";
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import { SITE_URL } from "./src/consts.ts";

export default defineConfig({
  site: SITE_URL,
  trailingSlash: "always", // or "never" – stay consistent
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
});
