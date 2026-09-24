/**
 * The board family as it stands after `0021-link-boards-to-content-boards`.
 * The family it replaces is not here: those components are gone from the space
 * once the migration has run, so they live only in the snapshot the migration
 * reads its source names from.
 */
import { defineBlock, defineField } from "@storyblok/schema";

import { headlineField } from "../fields";

export const contentBoardListItemBlock = defineBlock({
  name: "content_board_list_item",
  is_nestable: true,
  fields: [
    defineField("title", { type: "text", max_length: 120, translatable: true, required: true }),
    defineField("link", { type: "multilink" }),
    defineField("description", { type: "richtext", translatable: true }),
  ],
});

export const contentBoardListBlock = defineBlock({
  name: "content_board_list",
  is_nestable: true,
  fields: [
    headlineField,
    defineField("items", { type: "bloks", allow: [contentBoardListItemBlock.name] }),
  ],
});

export const contentBoardBlock = defineBlock({
  name: "content_board",
  is_nestable: true,
  fields: [
    headlineField,
    defineField("list", { type: "bloks", allow: [contentBoardListItemBlock.name] }),
    defineField("lists", { type: "bloks", allow: [contentBoardListBlock.name] }),
  ],
});
