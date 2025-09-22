import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string().optional(),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      category: z.string().optional(),
      tags: z.array(z.string()).default([]),
      featured: z.boolean().optional(),
      heroImage: z.union([image(), z.string()]).optional(),
      readingTime: z.number().optional(),
      slug: z.string().optional(), // ✅ new override field
    }),
});

export const collections = { blog };
