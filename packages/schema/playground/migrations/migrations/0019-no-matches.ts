/**
 * A migration against a block the migration's own `Before` snapshot declares and
 * no editor ever placed. The current schema does not have it at all, which is
 * the ordinary case: the snapshot is frozen at the shape the migration was
 * written against, and a block can be dropped from the schema afterwards.
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
