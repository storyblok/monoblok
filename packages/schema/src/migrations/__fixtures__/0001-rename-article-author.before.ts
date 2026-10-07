/**
 * Stands in for a generated `Before` snapshot, so the two-schema form is
 * exercised against the shape a generated one has. The real file is written by
 * the tool and not edited by hand.
 *
 * The schema as it stood before 0001-rename-article-author ran,
 * scoped to the blocks that migration touches plus everything reachable from
 * them. Frozen once shipped: later schema changes must not move it, or the
 * migration would start reading paths that did not exist when it was written.
 */
import { defineBlock, defineField, defineSchema } from "../../index";
import type { Schema } from "../../index";

export const articleBlock = defineBlock({
  name: "article",
  is_root: true,
  is_nestable: false,
  fields: [
    defineField("title", { type: "text", max_length: 120, required: true }),
    defineField("author", { type: "text", max_length: 80 }),
    defineField("excerpt", { type: "textarea", max_length: 300 }),
    defineField("body", { type: "richtext", allow: ["meta"] }),
  ],
});

export const metaBlock = defineBlock({
  name: "meta",
  is_root: false,
  is_nestable: true,
  fields: [
    defineField("author", { type: "text", max_length: 80 }),
    defineField("og_title", { type: "text", max_length: 120 }),
  ],
});

const schema = defineSchema({
  blocks: { articleBlock, metaBlock },
});

export type Before = Schema<typeof schema>;
