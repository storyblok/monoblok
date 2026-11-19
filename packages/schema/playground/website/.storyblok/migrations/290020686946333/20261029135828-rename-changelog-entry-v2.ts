import { defineMigration, renameBlock } from "@storyblok/schema";

import type { Schema } from "../../../src/schema/schema.js";
import type { Before } from "./20261029135828-rename-changelog-entry-v2.before.js";

export default defineMigration<Schema, Before>({
  title: "Rename changelog_entry_v2 to changelog_entry",
  ops: [renameBlock({ block: "changelog_entry_v2", to: "changelog_entry" })],
});
