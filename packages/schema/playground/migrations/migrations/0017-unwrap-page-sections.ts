/**
 * The other direction, and the direction that loses something. Several sections
 * dissolve into one flat list, and the list no longer records which section
 * each child came from or what heading and theme that section carried — so the
 * derived inverse can rebuild a wrapper but not the wrappers. `deriveInverse`
 * reports the op as lossy for exactly that reason, and a rollback that has to
 * be exact needs the patches the run recorded.
 */
import { defineMigration, unwrapChildren } from "@storyblok/schema/migrations";

import type { Schema } from "../src/schema/schema";

export default defineMigration<Schema>({
  title: "Flatten the sections a page holds directly",
  ops: [unwrapChildren({ block: "page", field: "body", unwrap: "section", from: "items" })],
});
