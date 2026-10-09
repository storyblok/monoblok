/**
 * Fixture — the post-migration schemas.
 *
 * One per migration under test, because a migration has exactly one `After`:
 * the schema module the developer just edited. In a project, `After` is the live
 * schema module; only `Before` is a generated snapshot.
 *
 * Post-condition validation runs against these and never against `Before`: the
 * whole point of a migration is that the content stops matching `Before`.
 */
import { defineBlock, defineField, defineSchema } from "../../index";
import type { Schema as InferSchema } from "../../index";
import { articleBlock, bannerBlock, cardBlock, metaBlock, pageBlock, sectionBlock } from "./schema";

/** 0001 — `article.author` becomes `byline`. */
const articleWithByline = defineBlock({
  name: "article",
  is_root: true,
  is_nestable: false,
  fields: [
    defineField("title", { type: "text", max_length: 120, required: true }),
    defineField("byline", { type: "text", max_length: 80 }),
    defineField("excerpt", { type: "textarea", max_length: 300 }),
    defineField("body", { type: "richtext" }),
  ],
});

export const afterRenameArticleAuthor = defineSchema({
  blocks: {
    pageBlock,
    articleWithByline,
    sectionBlock,
    cardBlock,
    metaBlock,
    bannerBlock,
  },
});

/** 0002 — `meta.author` becomes `written_by`, at every depth. */
const metaWithWrittenBy = defineBlock({
  name: "meta",
  is_nestable: true,
  fields: [
    defineField("written_by", { type: "text", max_length: 80 }),
    defineField("og_title", { type: "text", max_length: 120 }),
  ],
});

export const afterRenameMetaAuthor = defineSchema({
  blocks: {
    pageBlock,
    articleBlock,
    sectionBlock,
    cardBlock,
    metaWithWrittenBy,
    bannerBlock,
  },
});

/** 0003 — `card.description` is gone. */
const cardWithoutDescription = defineBlock({
  name: "card",
  is_nestable: true,
  fields: [
    defineField("title", { type: "text", max_length: 80, required: true }),
    defineField("legacy_price", { type: "text", max_length: 20 }),
    defineField("featured", { type: "text", max_length: 10 }),
    defineField("old_slug", { type: "text", max_length: 80 }),
    defineField("slug", { type: "text", max_length: 80 }),
    defineField("meta", { type: "bloks", allow: [metaBlock.name] }),
  ],
});

export const afterRemoveCardDescription = defineSchema({
  blocks: {
    pageBlock,
    articleBlock,
    sectionBlock,
    cardWithoutDescription,
    metaBlock,
    bannerBlock,
  },
});

/** 0004 — the two coerced fields change type. */
const cardWithTypedFields = defineBlock({
  name: "card",
  is_nestable: true,
  fields: [
    defineField("title", { type: "text", max_length: 80, required: true }),
    defineField("description", { type: "textarea", max_length: 300 }),
    defineField("legacy_price", { type: "number" }),
    defineField("featured", { type: "boolean" }),
    defineField("old_slug", { type: "text", max_length: 80 }),
    defineField("slug", { type: "text", max_length: 80 }),
    defineField("meta", { type: "bloks", allow: [metaBlock.name] }),
  ],
});

export const afterCoerceCardTypes = defineSchema({
  blocks: {
    pageBlock,
    articleBlock,
    sectionBlock,
    cardWithTypedFields,
    metaBlock,
    bannerBlock,
  },
});

/** 0008 — `article.excerpt` becomes `summary`; `card.title` stays text. */
const articleWithSummary = defineBlock({
  name: "article",
  is_root: true,
  is_nestable: false,
  fields: [
    defineField("title", { type: "text", max_length: 120, required: true }),
    defineField("author", { type: "text", max_length: 80 }),
    defineField("summary", { type: "textarea", max_length: 300 }),
    defineField("body", { type: "richtext" }),
  ],
});

export const afterTwoBlocks = defineSchema({
  blocks: {
    pageBlock,
    articleWithSummary,
    sectionBlock,
    cardBlock,
    metaBlock,
    bannerBlock,
  },
});

export type AfterTwoBlocks = InferSchema<typeof afterTwoBlocks>;
export type AfterRenameArticleAuthor = InferSchema<typeof afterRenameArticleAuthor>;
export type AfterRenameMetaAuthor = InferSchema<typeof afterRenameMetaAuthor>;
export type AfterRemoveCardDescription = InferSchema<typeof afterRemoveCardDescription>;
export type AfterCoerceCardTypes = InferSchema<typeof afterCoerceCardTypes>;
