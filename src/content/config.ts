import { defineCollection, z } from "astro:content";

const blog = defineCollection({
  type: "content",
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string().optional(),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      category: z.string().optional(),
      tags: z.array(z.string()).default([]), // ✅ always an array
      featured: z.boolean().optional(),
      heroImage: image().optional(),
      // readingTime is computed in utils, not here
      readingTime: z.number().optional(),
    }),
});

export const collections = { blog };
