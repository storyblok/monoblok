import { describe, expect, it } from "vitest";
import { addField, defineMigration } from "@storyblok/schema";
import { withoutStaleOps } from "./stale-ops";

const live = new Map([["page", new Map([["noindex", "text"]])]]);

describe("withoutStaleOps", () => {
  it("should leave an addField whose callback returns a promise to the run, without an unhandled rejection", async () => {
    const migration = defineMigration([
      addField({ block: "page", field: "noindex" }, async () => {
        throw new Error("Not a backfill value");
      }),
    ]);

    const { stale } = withoutStaleOps(migration, live);
    await new Promise((resolve) => setTimeout(resolve));

    expect(stale).toEqual([]);
  });
});
