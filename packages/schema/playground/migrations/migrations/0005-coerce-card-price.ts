/**
 * Coercing a `number` field is mostly about what it does to input that will not
 * parse, because the stored form is a string either way: Storyblok stores and
 * delivers a `number` field as a string, and an unset one as `""`. So `"19"`
 * coerces to `"19"` and nothing moves — the migration is a no-op on every card
 * whose price was already a number written as text.
 *
 * What it does move is the value that is not a number at all. `"twelve"` cannot
 * be parsed, so it coerces to `""` — the empty form, not the text and not
 * `null`. That is data loss, which is the whole reason `from` exists: stating
 * it lets `deriveInverse` produce the mirror coercion, and the run still
 * records the patches that hold the original string, because the mirror
 * coercion cannot conjure `"twelve"` back out of `""`.
 *
 * `null` is passed through untouched rather than coerced to `""`, so a card
 * that never had a price is left as the editor left it.
 */
import { coerceField, defineMigration } from "@storyblok/schema/migrations";

import type { Schema } from "../src/schema/schema";

export default defineMigration<Schema>({
  title: "Coerce card.price to a number",
  ops: [coerceField({ block: "card", field: "price", from: "string", to: "number" })],
});
