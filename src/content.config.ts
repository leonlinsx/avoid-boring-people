import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { MAX_DISCUSSION_PROMPT_LENGTH } from './lib/comments/domain.ts';
import { categoryLabels } from './utils/taxonomy';

const blog = defineCollection({
  loader: glob({
    pattern: '**/*.{md,mdx}',
    base: './src/content/blog',
    // Keep the Astro 5 IDs used by search-index.json and image paths.
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

export const collections = { blog };
