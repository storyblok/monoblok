/**
 * A new field, backfilled from one the block already has. The backfill runs
 * only where the field is absent, so a card an editor has since given a slug of
 * its own keeps it, and a rerun changes nothing.
 *
 * Returning `undefined` is how the op declines: a card with no headline has
 * nothing to derive a slug from, and is left without one rather than with an
 * empty string.
 */
import { addField, defineMigration } from "@storyblok/schema/migrations";

import type { Schema } from "../src/schema/schema";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default defineMigration<Schema>({
  title: "Backfill card.slug from card.headline",
  ops: [
    addField({ block: "card", field: "slug" }, (block) =>
      typeof block.headline === "string" && block.headline !== ""
        ? slugify(block.headline)
        : undefined,
    ),
  ],
});
