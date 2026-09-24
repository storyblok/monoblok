/**
 * A field whose type widens: one asset becomes a list of assets. Two ops in
 * order on the same block — the value is reshaped first, then the key is moved
 * to the name the new type deserves.
 *
 * The callback has to tolerate its own output. Every `alter` op is run a second
 * time on a copy to check it agrees with itself, so a callback that wraps
 * unconditionally would report itself non-idempotent on the first pass rather
 * than on someone's rerun.
 */
import { alterField, defineMigration, renameField } from "@storyblok/schema/migrations";

import type { Schema } from "../src/schema/schema";
import type { TeaserWithImages } from "../src/schema/snapshots/teaser-with-images";

export default defineMigration<TeaserWithImages, Schema>({
  title: "Turn teaser.image into teaser.images",
  ops: [
    alterField({ block: "teaser", field: "image" }, (image) => {
      if (Array.isArray(image)) {
        return image;
      }
      return image ? [image] : image;
    }),
    renameField({ block: "teaser", field: "image", to: "images" }),
  ],
});
