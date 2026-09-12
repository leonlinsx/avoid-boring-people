import { defineCollection, z } from 'astro:content';
import { categoryLabels } from '../utils/taxonomy';

const blog = defineCollection({
  type: 'content',
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
    }),
});

export const collections = { blog };
