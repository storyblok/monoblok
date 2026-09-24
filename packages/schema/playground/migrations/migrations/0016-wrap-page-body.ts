/**
 * A container level appears where there was none: everything the page held
 * directly now sits inside one section. The wrapper's id is derived from the
 * parent, the field and the container's component name, so a rerun produces the
 * id that is already there, the backend has no reason to regenerate it, and two
 * fields wrapped into the same component do not collide.
 *
 * That derived id is also what lets the op recognise its own work and decline
 * to add a second layer, which is the only reason wrapping is repeatable at all.
 */
import { defineMigration, wrapChildren } from "@storyblok/schema/migrations";

import type { Schema } from "../src/schema/schema";

export default defineMigration<Schema>({
  title: "Wrap everything on the page in one section",
  ops: [wrapChildren({ block: "page", field: "body", in: "section", into: "items" })],
});
