/**
 * The page before `0023-intro-to-teaser-with-spacers`, when it could still hold
 * an `intro`. The migration replaces that component with a `teaser` between two
 * `spacer`s, so the current schema no longer declares it.
 */
import { defineBlock, defineField, defineSchema } from "@storyblok/schema";
import type { Schema } from "@storyblok/schema";

const introBlock = defineBlock({
  name: "intro",
  is_nestable: true,
  fields: [
    defineField("headline", { type: "text", max_length: 120, translatable: true, required: true }),
    defineField("body", { type: "textarea", max_length: 300, translatable: true }),
  ],
});

const pageBlock = defineBlock({
  name: "page",
  is_root: true,
  is_nestable: false,
  fields: [defineField("body", { type: "bloks", allow: [introBlock.name] })],
});

const snapshot = defineSchema({ blocks: { pageBlock, introBlock } });

export type PageWithIntro = Schema<typeof snapshot>;
