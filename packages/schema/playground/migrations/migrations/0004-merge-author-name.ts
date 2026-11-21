/**
 * The mirror of 0003, and the one that shows why a merge needs its own
 * `split`: an author whose `last_name` is empty merges to a single word, and
 * nothing in the merged value says whether that word was the first half or the
 * second. The counterpart decides, and the decision is the author's to make.
 *
 * `splitName` is written out here and again in its counterpart rather than
 * shared. A migration is a frozen artefact: it has to keep doing what it did on
 * the day it ran, and a helper two files import is a helper someone edits for
 * the benefit of one of them.
 */
import { defineMigration, mergeFields } from "@storyblok/schema/migrations";

import type { Schema } from "../src/schema/schema";
import type { AuthorWithName } from "../src/schema/snapshots/author-with-name";

function splitName(value: unknown): [string, string] {
  const name = typeof value === "string" ? value.trim() : "";
  const lastSpace = name.lastIndexOf(" ");
  return lastSpace === -1 ? [name, ""] : [name.slice(0, lastSpace), name.slice(lastSpace + 1)];
}

export default defineMigration<AuthorWithName, Schema>({
  title: "Merge author.first_name and author.last_name into author.name",
  ops: [
    mergeFields(
      { block: "author", fields: ["first_name", "last_name"], into: "name", split: splitName },
      (values) => values.filter((value) => typeof value === "string" && value !== "").join(" "),
    ),
  ],
});
