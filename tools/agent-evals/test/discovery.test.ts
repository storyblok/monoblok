import { describe, expect, it } from "vitest";
import { discover } from "./discover.ts";

describe("cli profile", () => {
  it("runs the CLI scenarios one at a time", async () => {
    const { config, scenarios } = await discover("cli");
    expect(scenarios.map((s) => s.key).sort()).toEqual([
      "cli/offline/validate-schema",
      "cli/space/add-field",
      "cli/space/pull-components",
    ]);
    expect(config.settings?.concurrency).toBe(1);
  });
});
