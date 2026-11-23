import { defineBlock, defineField, defineSchema } from "@storyblok/schema";
import type { BlockContent, Schema as InferSchema, Story as InferStory } from "@storyblok/schema";
import type { WithInlinedRelations } from "@storyblok/api-client";

/**
 * Typed source of truth for the QA fixture's content shapes. Mirrors
 * `../integration-tests/schema/blocks.ts` exactly: both playgrounds render
 * the same seeded `test/scenarios/has-playground-content` fixture, so the
 * same Playwright spec (`test/visual-editor/specs/live-editing.spec.ts`) can
 * drive either one. Keep the two in sync by hand; there is no generator
 * between them.
 */
export const teaserBlock = defineBlock({
  name: "teaser",
  fields: [defineField("headline", { type: "text" }), defineField("text", { type: "richtext" })],
});

export const featureBlock = defineBlock({
  name: "feature",
  fields: [defineField("name", { type: "text" }), defineField("description", { type: "text" })],
});

export const gridBlock = defineBlock({
  name: "grid",
  fields: [defineField("columns", { type: "bloks", allow: [featureBlock] })],
});

export const articleBlock = defineBlock({
  name: "article",
  is_root: true,
  is_nestable: false,
  fields: [defineField("title", { type: "text" })],
});

export const featuredArticlesBlock = defineBlock({
  name: "featured-articles",
  fields: [
    defineField("heading", { type: "text" }),
    defineField("posts", { type: "options", source: "internal_stories" }),
  ],
});

export const pageBlock = defineBlock({
  name: "page",
  is_root: true,
  is_nestable: false,
  fields: [
    defineField("body", {
      type: "bloks",
      allow: [teaserBlock, gridBlock, featuredArticlesBlock],
    }),
  ],
});

export const schema = defineSchema({
  blocks: {
    pageBlock,
    teaserBlock,
    featureBlock,
    gridBlock,
    articleBlock,
    featuredArticlesBlock,
  },
});

export type Schema = InferSchema<typeof schema>;
export type Blocks = Schema["blocks"];
export type FieldPlugins = Schema["fieldPlugins"];
export type Story = InferStory<Blocks, FieldPlugins>;

// Type a component's props by block name: `Block<"hero">`.
export type Block<TName extends Blocks["name"]> = BlockContent<
  Extract<Blocks, { name: TName }>,
  Blocks,
  FieldPlugins
>;

/**
 * Type a component's props by block name when it's fetched with
 * `resolve_relations` and `inlineRelations: true`: `BlockWithRelations<"hero",
 * "hero.link">`. `TPaths` must match the `resolve_relations` query the
 * fetch actually used — a relation field not listed there stays a UUID
 * string.
 */
export type BlockWithRelations<
  TName extends Blocks["name"],
  TPaths extends string,
> = WithInlinedRelations<Extract<Blocks, { name: TName }>, TPaths, Blocks, FieldPlugins>;

/**
 * Narrows a relation field's value to the resolved story, dropping the UUID
 * string an unresolved relation (unpublished/deleted story) stays as.
 * `posts.filter(isResolvedRelation)`.
 */
export function isResolvedRelation<T>(value: T): value is Exclude<T, string> {
  return typeof value !== "string";
}
