import { defineMigration, renameField } from "@storyblok/schema";

import type { Schema } from "../../../src/schema/schema.js";
import type { Before } from "./20261029132727-rename-teaser-to-excerpt.before.js";

export default defineMigration<Schema, Before>({
  title: "Rename teaser to excerpt on blog entries and events",
  ops: [
    renameField({ block: "blog_entry", field: "teaser", to: "excerpt" }),
    renameField({ block: "event", field: "teaser", to: "excerpt" }),
  ],
});
