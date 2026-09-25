import { defineBlock, defineField, defineSchema } from "@storyblok/schema";
import type { Schema as InferSchema } from "@storyblok/schema";

export const articleBlock = defineBlock({
  name: "article",
  is_root: true,
  is_nestable: true,
  fields: [
    defineField("title", { type: "text", required: true }),
    defineField("author", { type: "options", source: "internal_stories" }),
    defineField("content", { type: "richtext" }),
  ],
});

export const featuredArticlesBlock = defineBlock({
  name: "featured-articles",
  is_nestable: true,
  fields: [
    defineField("title", { type: "text" }),
    defineField("articles", { type: "options", source: "internal_stories" }),
  ],
});

export const pageBlock = defineBlock({
  name: "page",
  is_root: true,
  is_nestable: false,
  fields: [
    defineField("body", {
      type: "bloks",
      allow: [articleBlock, featuredArticlesBlock],
    }),
  ],
});

export const schema = defineSchema({
  blocks: { pageBlock, articleBlock, featuredArticlesBlock },
});

export type Blocks = InferSchema<typeof schema>["blocks"];
export type StoryblokSchema = InferSchema<typeof schema>;
