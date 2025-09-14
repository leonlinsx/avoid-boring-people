import { z, defineCollection, image } from "astro:content";

const blog = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    pubDate: z.date(),
    updatedDate: z.date().optional(),
    category: z.string(),
    tags: z.array(z.string()).optional(),
    featured: z.boolean().optional(),

    // heroImage can be:
    // - Local image (Astro image pipeline)
    // - Absolute URL
    // - Relative string path (e.g. "./ergo_5.webp")
    heroImage: z
      .union([
        image().refine(
          (img) => img.width >= 1200 && img.height >= 630,
          {
            message:
              "Hero image must be at least 1200×630px for social sharing.",
          }
        ),
        z.string().url(),
        z.string(), // ✅ allow relative string paths like "./ergo_5.webp"
      ])
      .optional(),
  }),
});

export const collections = { blog };
