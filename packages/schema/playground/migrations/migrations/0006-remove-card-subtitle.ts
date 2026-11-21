/**
 * Removing a field that still holds text. The values only exist in the run's
 * recorded patches afterwards: `deriveInverse` refuses this op outright, since
 * an op list says which key went away and never what was in it.
 */
import { defineMigration, removeField } from "@storyblok/schema/migrations";

import type { Schema } from "../src/schema/schema";
import type { CardWithTitle } from "../src/schema/snapshots/card-with-title";

export default defineMigration<Schema, CardWithTitle>({
  title: "Drop card.subtitle",
  ops: [removeField({ block: "card", field: "subtitle" })],
});
