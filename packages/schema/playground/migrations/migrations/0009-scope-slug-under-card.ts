/**
 * The same block in two places, migrated in one of them. `under` reads
 * outermost first and allows gaps at every step, so `["section", "card"]` means
 * a card with a card above it that has a section above that — however many
 * levels sit in between.
 *
 * The fixtures hold both cases: a card embedded in the richtext of a card that
 * sits in a section (migrated), and a card embedded in the richtext of a card
 * that sits straight on the page (left alone). Scoping like this is only sound
 * because the value moves and the schema does not — the same `under` on a key
 * op is a type error, since half a component's instances cannot hold a key the
 * other half does not.
 */
import { alterField, defineMigration } from "@storyblok/schema/migrations";

import type { Schema } from "../src/schema/schema";

const NAMESPACE = "embedded/";

export default defineMigration<Schema>({
  title: "Namespace the slug of a card embedded in a card inside a section",
  ops: [
    alterField({ block: "card", field: "slug", under: ["section", "card"] }, (slug) =>
      typeof slug === "string" && slug !== "" && !slug.startsWith(NAMESPACE)
        ? `${NAMESPACE}${slug}`
        : slug,
    ),
  ],
});
