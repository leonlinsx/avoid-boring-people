// @ts-check

import mdx from "@astrojs/mdx";
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { SITE_URL } from './src/consts.ts';

export default defineConfig({
  site: SITE_URL,
  integrations: [sitemap(), mdx()],
});