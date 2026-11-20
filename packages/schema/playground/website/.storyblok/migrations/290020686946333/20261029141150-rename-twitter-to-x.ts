import { defineMigration, renameField } from "@storyblok/schema";

import type { Schema } from "../../../src/schema/schema.js";
import type { Before } from "./20261029141150-rename-twitter-to-x.before.js";

export default defineMigration<Schema, Before>({
  title: "Rename twitter_account to x_account on authors and MVPs",
  ops: [
    renameField({ block: "author", field: "twitter_account", to: "x_account" }),
    renameField({ block: "mvp", field: "twitter_account", to: "x_account" }),
  ],
});
