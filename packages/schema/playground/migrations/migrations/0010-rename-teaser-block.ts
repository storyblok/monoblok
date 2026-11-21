/**
 * Renaming the component itself, which moves every instance at once — the
 * content half of a decision the schema push makes on the component.
 *
 * It is the one op whose derived inverse targets a different block name than
 * the forward migration, so a caller replaying that inverse has to take the
 * targets from `DerivedInverse.targets` rather than from the migration it is
 * undoing. It is also the op that shows why a derived inverse is not a rollback
 * on its own: this space already had cards before the rename, and renaming
 * every card back to a teaser would sweep them up too.
 */
import { defineMigration, renameBlock } from "@storyblok/schema/migrations";

import type { Schema } from "../src/schema/schema";

export default defineMigration<Schema>({
  title: "Fold the teaser component into card",
  ops: [renameBlock({ block: "teaser", to: "card" })],
});
