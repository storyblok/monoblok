import { alterField, defineMigration } from "@storyblok/schema";

import type { Schema } from "../../../src/schema/schema.js";
import type { Before } from "./20261029141206-normalize-hero-headline-size.before.js";

const LEGACY_NORMAL = " ";

export default defineMigration<Schema, Before>({
  title: 'Store the normal hero headline size as "normal" instead of a space',
  ops: [
    alterField({ block: "hero", field: "headline_size" }, (size) =>
      size === LEGACY_NORMAL ? "normal" : undefined,
    ),
  ],
});
