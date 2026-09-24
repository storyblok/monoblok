/**
 * A field-level translation is not one key but a family: `headline` beside
 * `headline__i18n__de` beside `headline__i18n__fr`. Every op that names a field
 * names the whole family, and this one is told which member it is looking at,
 * so a rename the brand made in German can differ from the one it made
 * everywhere else.
 *
 * The language comes from the block's own keys at run time, never from the
 * schema: which languages a space has is space state, and one migration is
 * expected to run against spaces that disagree about it.
 */
import { alterField, defineMigration } from "@storyblok/schema/migrations";

import type { Schema } from "../src/schema/schema";

const OLD_NAME = "Legacy Portal";
const NEW_NAME = "Storyblok Portal";
/** German marketing kept its own name for the product rather than translating the English one. */
const NEW_NAME_BY_LANGUAGE: Record<string, string> = { de: "Storyblok Bereich" };

export default defineMigration<Schema>({
  title: "Rename the product in card headlines, German included",
  ops: [
    alterField({ block: "card", field: "headline" }, (headline, context) => {
      if (typeof headline !== "string" || !headline.includes(OLD_NAME)) {
        return headline;
      }
      const replacement =
        (context.language ? NEW_NAME_BY_LANGUAGE[context.language] : undefined) ?? NEW_NAME;
      return headline.replaceAll(OLD_NAME, replacement);
    }),
  ],
});
