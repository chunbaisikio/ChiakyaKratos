import { defineCollection } from "astro:content";
import { z } from "zod";
import { glob } from "astro/loaders";

const list = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((value) => (typeof value === "string" ? [value] : (value ?? [])));

export const collections = {
  albums: defineCollection({
    loader: glob({
      pattern: "**/*.json",
      base: "./source/_albums",
      generateId: ({ entry }) => entry.replace(/\.json$/, ""),
    }),
    schema: z.object({
      title: z.string(),
      date: z.coerce.date(),
      updated: z.coerce.date().optional(),
      kind: z.enum(["travel", "daily"]),
      draft: z.boolean().default(true),
      location: z.string().default(""),
      description: z.string().default(""),
      note: z.string().default(""),
      coverId: z.string().default(""),
      postSlug: z.string().default(""),
      photos: z.array(
        z.object({
          mediaId: z.uuid(),
          url: z.string().regex(/^\/assets\/uploads\/[a-f0-9-]{36}\.webp$/),
          thumbnail: z
            .string()
            .regex(/^\/assets\/uploads\/[a-f0-9-]{36}-thumb\.webp$/),
          width: z.number().int().positive(),
          height: z.number().int().positive(),
          alt: z.string().default(""),
          caption: z.string().default(""),
          takenAt: z.string().default(""),
        }),
      ),
    }),
  }),
  posts: defineCollection({
    loader: glob({
      pattern: "**/*.md",
      base: "./source/_posts",
      generateId: ({ entry }) => entry.replace(/\.md$/, ""),
    }),
    schema: z.object({
      title: z.string(),
      date: z.coerce.date(),
      updated: z.coerce.date().optional(),
      description: z.string().optional(),
      categories: list,
      tags: list,
      cover: z.string().optional(),
      sticky: z.number().optional(),
      draft: z.boolean().default(false),
      template: z
        .string()
        .regex(/^\/assets\/templates\/[a-f0-9-]{36}\.json$/)
        .optional(),
    }),
  }),
};
