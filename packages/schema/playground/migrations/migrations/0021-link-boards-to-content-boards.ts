/**
 * A family of three components renamed at once, two of them with a field that
 * changes name and one with a field that changes type.
 *
 * The shape a hand-written mapper takes for this job is a chain of
 * `if (blok.component === …)` branches, run once per component because the
 * legacy runner hands a mapper the blocks of one component at a time. Here the
 * component is what an op selects on, so the branches are the op list and the
 * six of them are one run.
 *
 * Every op names the block by its pre-migration name, including the ones that
 * run after the rename: the runner picks a block's ops from the name it had
 * when it was visited, so an op naming `content_board_list_item` would match
 * nothing until the next migration.
 *
 * The one thing the types cannot check here is `to`. It resolves against the
 * post-migration schema under the pre-migration block name, and these three
 * blocks are exactly the names that schema no longer has, so it widens to
 * `string` — a typo in `items` compiles. Renaming the fields in one migration
 * and the components in the next is what buys the check back.
 */
import {
  alterField,
  defineMigration,
  renameBlock,
  renameField,
} from "@storyblok/schema/migrations";

import type { Schema } from "../src/schema/schema";
import type { LinkBoards } from "../src/schema/snapshots/link-boards";

/**
 * Leaves anything that is not a string alone, which is what lets the op run
 * twice without wrapping its own output: the idempotency probe applies it a
 * second time to the document the first pass produced.
 */
function toRichtext(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }
  return {
    type: "doc",
    content: value === "" ? [] : [{ type: "paragraph", content: [{ type: "text", text: value }] }],
  };
}

export default defineMigration<Schema, LinkBoards>({
  title: "Rename the link board family to content boards",
  ops: [
    alterField({ block: "link_board_link", field: "teaser" }, toRichtext),
    renameField({ block: "link_board_link", field: "teaser", to: "description" }),
    renameBlock({ block: "link_board_link", to: "content_board_list_item" }),

    renameField({ block: "link_board", field: "links", to: "items" }),
    renameBlock({ block: "link_board", to: "content_board_list" }),

    renameField({ block: "link_boards", field: "links", to: "list" }),
    renameField({ block: "link_boards", field: "boards", to: "lists" }),
    renameBlock({ block: "link_boards", to: "content_board" }),
  ],
});
