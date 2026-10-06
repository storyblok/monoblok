import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderMarkdown, summarize } from "../scripts/compare.ts";
import { GRADE_PATH } from "../src/grade.ts";

const REPORT = path.resolve(import.meta.dirname, "fixtures/report");

describe("compare", () => {
  it("aggregates per skill and arm, counting a missing grade as a failed run", () => {
    const rows = summarize(REPORT);
    expect(rows).toEqual([
      expect.objectContaining({ skill: "triage", arm: "bare", runs: 1, objectivePassRate: 1 }),
      expect.objectContaining({
        skill: "triage",
        arm: "monoblok",
        runs: 2,
        objectivePassRate: 0.5,
      }),
    ]);
  });

  it("averages score, cost and tokens over the runs that report them", () => {
    const [bare, monoblok] = summarize(REPORT);
    expect(bare).toMatchObject({ meanAxisScore: 82, meanCostUsd: 0.4, meanTokens: 120_000 });
    expect(monoblok).toMatchObject({ meanAxisScore: 90, meanCostUsd: 0.3, meanTokens: 550 });
  });

  it("renders one table row per skill and arm", () => {
    const md = renderMarkdown(summarize(REPORT));
    expect(md).toContain("| triage | bare |");
    expect(md).toContain("| triage | monoblok |");
    expect(md).toContain("| triage | bare | 1 | 100% | 82.0 | 0.40 | 120k |");
  });

  it("shows n/a for objective pass when a row has no objective checks", () => {
    const md = renderMarkdown([
      {
        skill: "x",
        arm: "bare",
        runs: 1,
        objectivePassRate: null,
        meanAxisScore: null,
        meanCostUsd: null,
        meanTokens: null,
      },
    ]);
    expect(md).toContain("| x | bare | 1 | n/a | n/a | n/a | n/a |");
  });

  it("groups per-arm variants of a skill into one row per arm", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "report-"));
    try {
      const results = [
        { scenarioKey: "skills/triage@case-one--bare", agentName: "bare", axisScore: 60 },
        { scenarioKey: "skills/triage@case-two--bare", agentName: "bare", axisScore: 80 },
      ];
      fs.writeFileSync(path.join(dir, "report.json"), JSON.stringify({ version: 1, results }));
      const grade = path.join(
        dir,
        "scenarios/skills/triage@case-one--bare/bare/artifacts",
        GRADE_PATH,
      );
      fs.mkdirSync(path.dirname(grade), { recursive: true });
      fs.writeFileSync(grade, JSON.stringify({ checks: [{ name: "a", pass: true, detail: "" }] }));
      expect(summarize(dir)).toEqual([
        expect.objectContaining({
          skill: "triage",
          arm: "bare",
          runs: 2,
          objectivePassRate: 0.5,
          meanAxisScore: 70,
        }),
      ]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it.each(["spec/spec@case-one--monoblok", "cli/offline/validate-schema"])(
    "reports no objective pass rate for ungraded scenario %s",
    (scenarioKey) => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "report-"));
      try {
        const results = [{ scenarioKey, agentName: "monoblok", axisScore: 70 }];
        fs.writeFileSync(path.join(dir, "report.json"), JSON.stringify({ version: 1, results }));
        expect(summarize(dir)).toEqual([
          expect.objectContaining({ arm: "monoblok", runs: 1, objectivePassRate: null }),
        ]);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    },
  );
});
