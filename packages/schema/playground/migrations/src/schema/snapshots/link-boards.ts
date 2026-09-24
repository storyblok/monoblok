/**
 * The board family before `0021-link-boards-to-content-boards`: three
 * components, each renamed, two of them carrying a field the new name spells
 * differently, and a `teaser` that becomes a richtext `description`.
 *
 * Unlike the other snapshots, none of these blocks appears in the current
 * schema — the migration renames all three away. That is what costs the
 * migration its target-name checking: `to` resolves against the post-migration
 * schema under the pre-migration block name, which no longer exists there, so
 * it widens to `string`.
 */
import { defineBlock, defineField, defineSchema } from "@storyblok/schema";
import type { Schema } from "@storyblok/schema";

const linkBoardLinkBlock = defineBlock({
  name: "link_board_link",
  is_nestable: true,
  fields: [
    defineField("title", { type: "text", max_length: 120, translatable: true, required: true }),
    defineField("link", { type: "multilink" }),
    defineField("teaser", { type: "textarea", max_length: 300, translatable: true }),
  ],
});

const linkBoardBlock = defineBlock({
  name: "link_board",
  is_nestable: true,
  fields: [
    defineField("headline", { type: "text", max_length: 120, translatable: true }),
    defineField("links", { type: "bloks", allow: [linkBoardLinkBlock.name] }),
  ],
});

const linkBoardsBlock = defineBlock({
  name: "link_boards",
  is_nestable: true,
  fields: [
    defineField("headline", { type: "text", max_length: 120, translatable: true }),
    defineField("links", { type: "bloks", allow: [linkBoardLinkBlock.name] }),
    defineField("boards", { type: "bloks", allow: [linkBoardBlock.name] }),
  ],
});

const snapshot = defineSchema({
  blocks: { linkBoardsBlock, linkBoardBlock, linkBoardLinkBlock },
});

export type LinkBoards = Schema<typeof snapshot>;
