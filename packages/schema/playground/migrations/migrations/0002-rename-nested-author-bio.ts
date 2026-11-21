/**
 * The same block at four depths and under three different parents: directly on
 * the page, inside a section, inside a teaser's `authors`, and inside a quote's
 * `authors`. A migration that walks only the root block's `body` reaches the
 * first of those and misses the rest.
 */
import { defineMigration, renameField } from "@storyblok/schema/migrations";

import type { Schema } from "../src/schema/schema";
import type { AuthorWithBiography } from "../src/schema/snapshots/author-with-biography";

export default defineMigration<AuthorWithBiography, Schema>({
  title: "Rename author.bio to author.biography at every depth",
  ops: [renameField({ block: "author", field: "bio", to: "biography" })],
});
