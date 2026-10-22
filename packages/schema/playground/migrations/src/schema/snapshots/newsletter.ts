/**
 * A block the schema declared and no editor ever used. The `Before` of
 * `0019-no-matches`: a migration can be perfectly well typed against a block
 * that no story contains, and a run against it has to be a no-op rather than an
 * error.
 */
import { defineBlock, defineField, defineSchema } from "@storyblok/schema";
import type { Schema } from "@storyblok/schema";

const newsletterBlock = defineBlock({
  name: "newsletter",
  is_nestable: true,
  fields: [
    defineField("headline", { type: "text", max_length: 120 }),
    defineField("consent_text", { type: "textarea" }),
  ],
});

const snapshot = defineSchema({ blocks: { newsletterBlock } });

export type WithNewsletter = Schema<typeof snapshot>;
