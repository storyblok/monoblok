import { defineMigration, splitField } from "@storyblok/schema";

import type { Schema } from "../../../src/schema/schema.js";
import type { Before } from "./20261029134313-split-quote-full-name.before.js";

const TITLE = /^(?:Dr|Prof|Mr|Mrs|Ms)\.?$/i;
// Longer values, or ones with a comma, are attributions such as
// "Head of Digitization, Telco" rather than names; editors split those by hand.
const MAX_NAME_PARTS = 4;

function splitName(fullName: string): [givenName: string, familyName: string] {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1 || parts.length > MAX_NAME_PARTS || fullName.includes(",")) {
    return [fullName.trim(), ""];
  }
  const givenParts = TITLE.test(parts[0]) ? 2 : 1;
  return [parts.slice(0, givenParts).join(" "), parts.slice(givenParts).join(" ")];
}

export default defineMigration<Schema, Before>({
  title: "Split quote full name into given and family name",
  ops: [
    splitField(
      {
        block: "new_quote",
        field: "full_name",
        into: ["given_name", "family_name"],
        merge: (values) => values.filter(Boolean).join(" "),
      },
      (fullName) => splitName(fullName ?? ""),
    ),
  ],
});
