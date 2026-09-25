/**
 * The other direction, and the direction that loses something. Several sections
 * dissolve into one flat list, and the list no longer records which section
 * each child came from or what heading and theme that section carried — so the
 * derived inverse can rebuild a wrapper but not the wrappers. `deriveInverse`
 * reports the op as lossy for exactly that reason, and a rollback that has to
 * be exact needs the patches the run recorded.
 *
 * Against this space it is also refused, and that is the more interesting half.
 * A section may hold a section, so dissolving the outer one lifts the inner one
 * into the field the op reads, where the next run dissolves that too. Nothing
 * about the op or the way it is written is wrong; it simply does not settle on
 * this content, and a migration that would rewrite the space differently every
 * time it runs is not one to write. The engine reports it and the runner
 * declines rather than leaving it to be discovered on the second run.
 */
import { defineMigration, unwrapChildren } from "@storyblok/schema/migrations";

import type { Schema } from "../src/schema/schema";

export default defineMigration<Schema>({
  title: "Flatten the sections a page holds directly",
  ops: [unwrapChildren({ block: "page", field: "body", unwrap: "section", from: "items" })],
});
