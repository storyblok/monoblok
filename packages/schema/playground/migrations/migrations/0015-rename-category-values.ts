/**
 * The datasource entries were renamed, so the values stored against them have
 * to follow. Nothing about the field moves — the option list it draws from did,
 * and the content is now holding keys that resolve to nothing.
 *
 * A value the map does not mention is left alone, which is what keeps the run
 * repeatable and keeps an entry added since the migration was written from
 * being swallowed.
 */
import { alterField, defineMigration } from "@storyblok/schema/migrations";

import type { Schema } from "../src/schema/schema";

const RENAMED: Record<string, string> = { billing: "payments", general: "basics" };

export default defineMigration<Schema>({
  title: "Follow the renamed FAQ category datasource entries",
  ops: [
    alterField({ block: "faq", field: "categories" }, (categories) =>
      Array.isArray(categories)
        ? categories.map((value) => (typeof value === "string" ? (RENAMED[value] ?? value) : value))
        : categories,
    ),
  ],
});
