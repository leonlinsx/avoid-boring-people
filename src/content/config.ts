import { defineCollection, z } from "astro:content";

const blog = defineCollection({
  type: "content", // important if mixing md + mdx
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.date(),
    updatedDate: z.date().optional(),
    category: z.enum([
      "Finance",
      "Tech",
      "Book Notes",
      "Movement",
      "Lifestyle",
    ]),
    heroImage: z.string().optional(),
    readingTime: z.number().optional(),
  }),
});

export const collections = { blog };
