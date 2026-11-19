import { alterField, defineMigration } from "@storyblok/schema";

import type { Schema } from "../../../src/schema/schema.js";
import type { Before } from "./20261029133458-trim-quote-names-and-roles.before.js";

// Returning undefined leaves a value that is already trimmed unchanged.
const trimmed = (value: string | null | undefined) => {
  const result = value?.trim();
  return result === value ? undefined : result;
};

export default defineMigration<Schema, Before>({
  title: "Trim stray whitespace from quote names and roles",
  ops: [
    alterField({ block: "new_quote", field: "full_name" }, trimmed),
    alterField({ block: "new_quote", field: "role" }, trimmed),
  ],
});
