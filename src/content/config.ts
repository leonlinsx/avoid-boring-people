import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.date(),
    updatedDate: z.date().optional(),
    category: z.enum([
      'Finance',
      'Tech',
      'Book Notes',
      'Movement',
      'Lifestyle'
    ]),
    // readingTime is computed dynamically, not written in frontmatter
    readingTime: z.number().optional(),
  }),
});

export const collections = { blog };
