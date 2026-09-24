/**
 * One field into two. The `merge` counterpart is optional and is what moves the
 * op from "needs the patches the run recorded" to "rolls back anywhere": with
 * it, `deriveInverse` can hand back a `mergeFields` that puts the halves
 * together again.
 *
 * Both directions stay lossy all the same. A name with two spaces in it, or a
 * last name that is itself two words, does not survive the round trip
 * unchanged — which is why the derived inverse is offered but not trusted.
 *
 * `splitName` is written out here and again in its counterpart rather than
 * shared. A migration is a frozen artefact: it has to keep doing what it did on
 * the day it ran, and a helper two files import is a helper someone edits for
 * the benefit of one of them.
 */
import { defineMigration, splitField } from "@storyblok/schema/migrations";

import type { Schema } from "../src/schema/schema";
import type { AuthorWithName } from "../src/schema/snapshots/author-with-name";

/** The last space separates the two halves, so "Ada Lovelace" splits but "Prince" does not. */
function splitName(value: unknown): [string, string] {
  const name = typeof value === "string" ? value.trim() : "";
  const lastSpace = name.lastIndexOf(" ");
  return lastSpace === -1 ? [name, ""] : [name.slice(0, lastSpace), name.slice(lastSpace + 1)];
}

function joinName(values: readonly unknown[]): string {
  return values.filter((value) => typeof value === "string" && value !== "").join(" ");
}

export default defineMigration<Schema, AuthorWithName>({
  title: "Split author.name into first_name and last_name",
  ops: [
    splitField(
      { block: "author", field: "name", into: ["first_name", "last_name"], merge: joinName },
      splitName,
    ),
  ],
});
