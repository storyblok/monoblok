import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readIssueLabels } from "../src/scenarios/triage.ts";
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
    ]);
    expect(config.judging?.agents).toEqual([{ agent: "claude-code", model: "claude-opus-5-5" }]);
  });
});

const SKILL_CASES = [
  "investigate@cli-single-option-empty-type",
  "investigate@js-client-strip-version-mapi",
  "investigate@richtext-vue-slot-warning",
  "plan-implement@cli-single-option-empty-type",
  "plan-implement@js-client-strip-version-mapi",
  "plan-implement@richtext-vue-slot-warning",
  "qa-engineer-unit@astro-circular-dependency-tdz",
  "qa-engineer-unit@cli-components-push-preview-tmpl",
  "qa-engineer-unit@js-client-filter-query-brackets",
  "review-and-qa@cli-components-push-preview-tmpl",
  "review-and-qa@react-rsc-bridge-exports",
  "review-and-qa@richtext-vue-slot-warning",
  "triage@astro-circular-dependency-tdz",
  "triage@cli-components-push-preview-tmpl",
  "triage@js-client-filter-query-brackets",
  "triage@js-client-strip-version-mapi",
];
const ARMS = ["bare", "monoblok", "superpowers"];

describe("skills profile", () => {
  it("has one scenario per skill, case, and arm, each run only by its arm", async () => {
    const { config, scenarios } = await discover("skills");
    expect(config.settings?.concurrency).toBe(3);
    const expected = SKILL_CASES.flatMap((c) => ARMS.map((arm) => `skills/${c}--${arm}`));
    expect(scenarios.map((s) => s.key).sort()).toEqual(expected.sort());
    for (const s of scenarios) {
      expect(s.artifacts).toContain(".agent-evals/grade.json");
      expect(s.setup?.[0]).toMatchObject({ action: "run_script" });
      expect(s.agents).toEqual([s.key.split("--").at(-1)]);
    }
  });

  it.each([
    ["investigate", "/investigate ", "/superpowers:systematic-debugging "],
    ["plan-implement", "/plan ", "/superpowers:writing-plans "],
    ["qa-engineer-unit", "/qa-engineer-unit ", "/superpowers:test-driven-development "],
    ["review-and-qa", "/review-and-qa ", "/superpowers:requesting-code-review "],
    ["triage", "/triage ", ""],
  ])(
    "invokes each arm's %s skill explicitly on the same task",
    async (skill, monoblokPrefix, superpowersPrefix) => {
      const { scenarios } = await discover("skills");
      const caseKey = SKILL_CASES.find((c) => c.startsWith(`${skill}@`));
      const promptOf = (arm: string): string =>
        scenarios.find((s) => s.key === `skills/${caseKey}--${arm}`)?.prompt ?? "";
      const task = promptOf("bare");
      expect(task.startsWith("/")).toBe(false);
      expect(promptOf("monoblok")).toBe(`${monoblokPrefix}${task}`);
      expect(promptOf("superpowers")).toBe(`${superpowersPrefix}${task}`);
    },
  );

  it("asks plan-implement arms to implement the plan, not stop after planning", async () => {
    const { scenarios } = await discover("skills");
    const plan = scenarios.find(
      (s) => s.key === "skills/plan-implement@cli-single-option-empty-type--monoblok",
    );
    expect(plan?.prompt).toContain("then implement it");
  });

  it("snapshots workspaces exported at the fix under a neutral commit message", async () => {
    const { scenarios } = await discover("skills");
    const setupOf = (key: string): string =>
      JSON.stringify(scenarios.find((s) => s.key === key)?.setup);
    expect(setupOf("skills/qa-engineer-unit@astro-circular-dependency-tdz--bare")).toContain(
      "--message 'chore: snapshot'",
    );
    expect(setupOf("skills/review-and-qa@react-rsc-bridge-exports--bare")).toContain(
      "--message 'chore: snapshot'",
    );
    expect(setupOf("skills/investigate@richtext-vue-slot-warning--bare")).not.toContain(
      "--message",
    );
  });

  it("keeps skill scenarios out of the cli profile", async () => {
    const { scenarios } = await discover("cli");
    expect(scenarios.every((s) => s.key.startsWith("cli/"))).toBe(true);
  });

  it("skips the dependency install when a scenario only reads source", async () => {
    const { scenarios } = await discover("skills");
    const setupOf = (key: string): string =>
      JSON.stringify(scenarios.find((s) => s.key === key)?.setup);
    expect(setupOf("skills/triage@cli-components-push-preview-tmpl--bare")).toContain(
      "--no-install",
    );
    expect(setupOf("skills/investigate@richtext-vue-slot-warning--bare")).not.toContain(
      "--no-install",
    );
  });

  it.each([['{"labels": ["pkg: cli"]}'], ['["pkg: cli", 3]']])(
    "rejects a label vocabulary that is not a string array: %s",
    (content) => {
      const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "labels-")), "labels.json");
      fs.writeFileSync(file, content);
      expect(() => readIssueLabels(file)).toThrow(/array of label strings/);
    },
  );

  it("gives triage the repository's label vocabulary", async () => {
    const { scenarios } = await discover("skills");
    const triage = scenarios.find(
      (s) => s.key === "skills/triage@js-client-strip-version-mapi--bare",
    );
    expect(triage?.prompt).toContain("pkg: storyblok-js-client");
  });
});

describe("spec profile", () => {
  it("gives the monoblok arms /spec and the others the plain request, on the interactive adapter", async () => {
    const { config, scenarios } = await discover("spec");
    const agents = config.agents.map((a) => (typeof a === "string" ? { agent: a } : a));
    expect(new Set(agents.map((a) => a.agent))).toEqual(new Set(["claude-code-interactive"]));
    expect(scenarios).toHaveLength(2 * 3);
    const monoblok = scenarios.find((s) => s.key === "spec/spec@cli-stories-validate--monoblok");
    const superpowers = scenarios.find(
      (s) => s.key === "spec/spec@cli-stories-validate--superpowers",
    );
    expect(monoblok?.agents).toEqual(["monoblok"]);
    expect(monoblok?.prompt.startsWith("/spec ")).toBe(true);
    expect(superpowers?.agents).toEqual(["superpowers"]);
    expect(superpowers?.prompt.startsWith("/superpowers:brainstorming ")).toBe(true);
    expect(superpowers?.prompt).toContain("Save it as a Markdown file");
    const bare = scenarios.find((s) => s.key === "spec/spec@cli-stories-validate--bare");
    expect(bare?.prompt.startsWith("/")).toBe(false);
    expect(bare?.prompt).toContain("claude-output/");
  });

  it("keeps spec scenarios out of the default run", async () => {
    const { scenarios } = await discover();
    expect(scenarios.some((s) => s.key.startsWith("spec/"))).toBe(false);
  });
});

describe("judge criteria", () => {
  it.each([undefined, "skills", "spec", "cli"])(
    "weights every criterion explicitly so AXIS does not drop unweighted checks (profile %s)",
    async (profile) => {
      const { scenarios } = await discover(profile);
      expect(scenarios.length).toBeGreaterThan(0);
      for (const s of scenarios) {
        expect(Array.isArray(s.judge), s.key).toBe(true);
        const criteria = Array.isArray(s.judge) ? s.judge : [];
        for (const criterion of criteria) {
          const weight = typeof criterion === "object" ? criterion.weight : undefined;
          expect(
            typeof weight === "number" && weight > 0,
            `${s.key}: ${JSON.stringify(criterion)}`,
          ).toBe(true);
        }
      }
    },
  );
});
