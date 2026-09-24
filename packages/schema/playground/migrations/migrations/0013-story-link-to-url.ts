/**
 * A multilink that stops pointing at a story and starts pointing at a path. The
 * field keeps its type and its name; only the value's internal shape changes,
 * which is the case a key op cannot express and a value op can.
 *
 * A link the migration already converted comes back unchanged, so the run is
 * repeatable — the `linktype` is what says whether there is anything left to do.
 */
import { alterField, defineMigration } from "@storyblok/schema/migrations";

import type { Schema } from "../src/schema/schema";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export default defineMigration<Schema>({
  title: "Turn card story links into url links",
  ops: [
    alterField({ block: "card", field: "link" }, (link) => {
      if (!isRecord(link) || link.linktype !== "story") {
        return link;
      }
      const path = typeof link.cached_url === "string" ? `/${link.cached_url}` : "";
      return { ...link, id: "", linktype: "url", url: path, cached_url: path };
    }),
  ],
});
