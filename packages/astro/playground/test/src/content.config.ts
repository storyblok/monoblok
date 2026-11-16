import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";

// Fixture for e2e/head-propagation.spec.ts.
const notes = defineCollection({
  loader: glob({ pattern: "*.mdx", base: "./src/content/notes" }),
});

export const collections = { notes };
