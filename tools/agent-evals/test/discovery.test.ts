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

describe("skills profile", () => {
  it("has one scenario per skill and case, all parallel-safe", async () => {
    const { config, scenarios } = await discover("skills");
    expect(config.settings?.concurrency).toBe(3);
    expect(scenarios.map((s) => s.key).sort()).toEqual(
      [
        "skills/investigate@cli-single-option-empty-type",
        "skills/investigate@js-client-strip-version-mapi",
        "skills/investigate@richtext-vue-slot-warning",
        "skills/plan-implement@cli-single-option-empty-type",
        "skills/plan-implement@js-client-strip-version-mapi",
        "skills/plan-implement@richtext-styled-link-shattered",
        "skills/qa-engineer-unit@astro-circular-dependency-tdz",
        "skills/qa-engineer-unit@cli-components-push-preview-tmpl",
        "skills/qa-engineer-unit@js-client-filter-query-brackets",
        "skills/review-and-qa@cli-components-push-preview-tmpl",
        "skills/review-and-qa@react-rsc-bridge-exports",
        "skills/review-and-qa@richtext-vue-slot-warning",
        "skills/triage@astro-circular-dependency-tdz",
        "skills/triage@cli-components-push-preview-tmpl",
        "skills/triage@js-client-filter-query-brackets",
        "skills/triage@js-client-strip-version-mapi",
      ].sort(),
    );
    for (const s of scenarios) {
      expect(s.artifacts).toContain(".agent-evals/grade.json");
      expect(s.setup?.[0]).toMatchObject({ action: "run_script" });
    }
  });

  it("keeps skill scenarios out of the cli profile", async () => {
    const { scenarios } = await discover("cli");
    expect(scenarios.every((s) => s.key.startsWith("cli/"))).toBe(true);
  });

  it("skips the dependency install when a scenario only reads source", async () => {
    const { scenarios } = await discover("skills");
    const setupOf = (key: string): string =>
      JSON.stringify(scenarios.find((s) => s.key === key)?.setup);
    expect(setupOf("skills/triage@cli-components-push-preview-tmpl")).toContain("--no-install");
    expect(setupOf("skills/investigate@richtext-vue-slot-warning")).not.toContain("--no-install");
  });

  it("gives triage the repository's label vocabulary", async () => {
    const { scenarios } = await discover("skills");
    const triage = scenarios.find((s) => s.key === "skills/triage@js-client-strip-version-mapi");
    expect(triage?.prompt).toContain("pkg: storyblok-js-client");
  });
});

describe("spec profile", () => {
  it("gives the monoblok arms /spec and the others the plain request, on the interactive adapter", async () => {
    const { config, scenarios } = await discover("spec");
    const agents = config.agents.map((a) => (typeof a === "string" ? { agent: a } : a));
    expect(new Set(agents.map((a) => a.agent))).toEqual(new Set(["claude-code-interactive"]));
    expect(scenarios).toHaveLength(2 * 4);
    const monoblok = scenarios.find((s) => s.key === "spec/spec@cli-stories-validate--monoblok");
    const superpowers = scenarios.find(
      (s) => s.key === "spec/spec@cli-stories-validate--superpowers",
    );
    expect(monoblok?.agents).toEqual(["monoblok"]);
    expect(monoblok?.prompt.startsWith("/spec ")).toBe(true);
    expect(superpowers?.agents).toEqual(["superpowers"]);
    expect(superpowers?.prompt.startsWith("/spec")).toBe(false);
  });

  it("keeps spec scenarios out of the default run", async () => {
    const { scenarios } = await discover();
    expect(scenarios.some((s) => s.key.startsWith("spec/"))).toBe(false);
  });
});
