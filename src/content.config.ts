import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { MAX_DISCUSSION_PROMPT_LENGTH } from './lib/comments/domain.ts';
import { categoryLabels } from './utils/taxonomy';

const blog = defineCollection({
  loader: glob({
    pattern: '**/*.{md,mdx}',
    base: './src/content/blog',
    // After the Astro 7 migration, retain relative-path IDs (including extensions)
    // so search-index.json, publish ledgers, and image paths remain compatible.
    generateId: ({ entry }) => entry,
  }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string().optional(),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      category: z.enum(categoryLabels),
      tags: z.array(z.string()).default([]),
      featured: z.boolean().optional(),
      // Evergreen redistribution is the default: articles are eligible unless
      // they are explicitly marked `evergreen: false` (time-sensitive pieces).
      evergreen: z.boolean().default(true),
      heroImage: z.union([image(), z.string()]).optional(),
      readingTime: z.number().optional(),
      slug: z.string().optional(), // ✅ new override field
      // Optional per-article prompt shown above the discussion box. Omit it to
      // use the default question.
      discussionPrompt: z.string().max(MAX_DISCUSSION_PROMPT_LENGTH).optional(),
    }),
});

// Generated translations live outside the English blog collection so they can
// never leak into RSS, search, related posts, or distribution automation. Each
// file mirrors its English source directory:
// `src/content/i18n/<locale>/<entry>/index.md`.
const i18n = defineCollection({
  loader: glob({
    pattern: '**/index.{md,mdx}',
    base: './src/content/i18n',
    generateId: ({ entry }) => entry,
  }),
  schema: () =>
    z.object({
      title: z.string(),
      description: z.string().optional(),
      locale: z.enum(['ja', 'ko', 'es', 'pt-BR', 'fr', 'zh-Hans']),
      sourceSlug: z.string(),
      sourceHash: z.string(),
    }),
});

export const collections = { blog, i18n };
