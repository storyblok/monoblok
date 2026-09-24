/**
 * A reorder whose comparator cannot be written from the two items alone: the
 * teaser moves to the front and everything else keeps the order the editor
 * gave it, which is a statement about position, not about content.
 *
 * `context.index` is what makes that expressible. Comparing positions as the
 * tie-break also makes the sort stable across engines and makes a rerun a
 * no-op, since the second pass sorts an already sorted list.
 */
import { defineMigration, reorderField } from "@storyblok/schema/migrations";

import type { Schema } from "../src/schema/schema";

export default defineMigration<Schema>({
  title: "Pin the teaser to the top of the page",
  ops: [
    reorderField({ block: "page", field: "body" }, (a, b, context) => {
      const rank = (child: typeof a): number => (child.component === "teaser" ? 0 : 1);
      return rank(a) - rank(b) || context.index(a) - context.index(b);
    }),
  ],
});
