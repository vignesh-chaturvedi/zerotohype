import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const link = z.object({
  title: z.string(),
  url: z.string().url(),
  /** Who published it, when it isn't the official docs. */
  by: z.string().optional(),
});

/** One track of the roadmap: what to read, what to build, and the lesson itself. */
const tracks = defineCollection({
  loader: glob({ base: "./src/content/tracks", pattern: "*.md" }),
  schema: z.object({
    order: z.number().int().positive(),
    code: z.string(),
    stage: z.enum(["Foundations", "Trading", "Deploying markets", "Contracts and infra"]),
    title: z.string(),
    summary: z.string(),
    /** `lesson` tracks have a full write-up; `links` tracks list their reading for now. */
    depth: z.enum(["lesson", "links"]),
    /** When the lesson's facts were last checked against the live API. */
    verified: z.coerce.date().optional(),
    docs: z.array(link).min(1),
    outside: z.array(link).default([]),
    build: z
      .array(
        z.object({
          label: z.string(),
          kind: z.enum(["lab", "workbench", "project", "guide"]),
          status: z.enum(["planned", "live"]).default("planned"),
        }),
      )
      .default([]),
  }),
});

export const collections = { tracks };
