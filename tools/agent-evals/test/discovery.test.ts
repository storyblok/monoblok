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

describe("arms", () => {
  it("runs every arm on the same pinned model, judged by plain claude-code", async () => {
    const { config } = await discover();
    const agents = config.agents.map((a) => (typeof a === "string" ? { agent: a } : a));
    expect(agents.map((a) => [a.name, a.agent, a.model])).toEqual([
      ["bare", "claude-code-arm", "claude-opus-5-5"],
      ["monoblok", "claude-code-arm", "claude-opus-5-5"],
      ["superpowers", "claude-code-arm", "claude-opus-5-5"],
      ["monoblok-superpowers", "claude-code-arm", "claude-opus-5-5"],
    ]);
    expect(config.judging?.agents).toEqual([{ agent: "claude-code", model: "claude-opus-5-5" }]);
  });
});
