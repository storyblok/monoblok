/**
 * The plainest case there is: one field, one new name, everywhere the component
 * appears. It is also the case that shows what a key op means — the rename
 * moves the component's schema, so it cannot be scoped to some cards and not
 * others, and the op takes no `under`.
 */
import { defineMigration, renameField } from "@storyblok/schema/migrations";

import type { Schema } from "../src/schema/schema";
import type { CardWithTitle } from "../src/schema/snapshots/card-with-title";

export default defineMigration<Schema, CardWithTitle>({
  title: "Rename card.title to card.headline",
  ops: [renameField({ block: "card", field: "title", to: "headline" })],
});
