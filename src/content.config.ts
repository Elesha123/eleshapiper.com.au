import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string(),
      slug: z.string(),
      category: z.string(),
      pubDate: z.coerce.date(),
      readTime: z.string(),
      cover: image().optional(),
      draft: z.boolean().default(false),
    }),
});

const magnets = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/magnets' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string(),
      slug: z.string(),
      format: z.string(),
      keyword: z.string(),
      subhead: z.string(),
      benefits: z.array(z.string()).length(3),
      formHeading: z.string(),
      formButton: z.string(),
      insideTitle: z.string(),
      insideItems: z
        .array(z.object({ title: z.string(), body: z.string() }))
        .length(3),
      testimonial: z.object({ quote: z.string(), name: z.string() }).optional(),
      closingHeadline: z.string(),
      closingBody: z.string(),
      closingButton: z.string(),
      cover: image().optional(),
    }),
});

export const collections = { blog, magnets };
