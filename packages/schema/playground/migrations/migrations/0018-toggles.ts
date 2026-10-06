/**
 * The refusal case, kept as a row because a catalogue of what works says
 * nothing about what happens when an author gets it wrong.
 *
 * Flipping a value is the easiest mistake to make and the hardest to notice: it
 * applies cleanly, it produces a plausible result, and running it twice undoes
 * it. Every `alter` op is therefore run a second time on a copy and its two
 * results compared, so this is reported as `nonIdempotent` before anything is
 * written rather than discovered when someone reruns the migration.
 */
import { alterBlock, defineMigration } from "@storyblok/schema/migrations";

import type { Schema } from "../src/schema/schema";

export default defineMigration<Schema>({
  title: "Flip gallery.show_captions (deliberately not repeatable)",
  ops: [
    alterBlock({ block: "gallery" }, (block) => {
      block.show_captions = !block.show_captions;
    }),
  ],
});
