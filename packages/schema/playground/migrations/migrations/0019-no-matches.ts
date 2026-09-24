/**
 * A migration against a block the schema declares and no editor ever placed.
 * It type-checks, it runs, and it does nothing — which is the behaviour that
 * matters: a run that matched nothing is an ordinary outcome, not an error, and
 * the space is left untouched rather than rewritten with identical content.
 */
import { defineMigration, removeField } from "@storyblok/schema/migrations";

import type { Schema } from "../src/schema/schema";
import type { WithNewsletter } from "../src/schema/snapshots/newsletter";

export default defineMigration<Schema, WithNewsletter>({
  title: "Drop newsletter.consent_text, which no story carries",
  ops: [removeField({ block: "newsletter", field: "consent_text" })],
});
