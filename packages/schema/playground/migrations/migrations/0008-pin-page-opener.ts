/**
 * A reorder that cannot be written from the two items being compared. The page
 * gets one opener: the first teaser moves to the top, and a second teaser
 * further down stays exactly where the editor put it. Both items look identical
 * to a comparator that can only read their fields, so the rule is unstateable
 * without knowing where each one sits.
 *
 * `context` is what makes it stateable. `siblings` is the array as it stood
 * before the sort, `index` gives a child's place in it, and between them the
 * comparator can say "the earliest teaser" rather than "a teaser". The `legacy`
 * page carries two teasers precisely so the difference shows: rank by component
 * and both rise, rank by position and only the opener does.
 *
 * Ties need no tie-break. The engine sorts with `Array.prototype.sort`, which
 * is stable, so everything the comparator calls equal keeps the order it had.
 */
import { defineMigration, reorderField } from "@storyblok/schema/migrations";

import type { Schema } from "../src/schema/schema";

export default defineMigration<Schema>({
  title: "Pin the page's first teaser to the top",
  ops: [
    reorderField({ block: "page", field: "body" }, (a, b, context) => {
      const opener = context.siblings.findIndex((child) => child.component === "teaser");
      const rank = (child: typeof a): number => (context.index(child) === opener ? 0 : 1);
      return rank(a) - rank(b);
    }),
  ],
});
