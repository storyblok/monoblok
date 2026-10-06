import type { ScenarioInput } from "@netlify/axis";
import type { BugCase } from "../cases.ts";
import { GRADE_ARTIFACTS, NO_UPSTREAM_CHECK, prepare, script, withIssue } from "./shared.ts";

export function triageScenario(cases: readonly BugCase[]): ScenarioInput {
  return {
    name: "Triage an issue",
    prompt: "",
    judge: "",
    limits: { time_minutes: 15 },
    artifacts: [...GRADE_ARTIFACTS, "triage.json", "triage.md"],
    variants: cases.map((c) => ({
      name: c.id,
      setup: [prepare(c.preFixRef, c, { install: false })],
      prompt: withIssue(
        c,
        "Triage this GitHub issue for the monoblok repository. Do not modify GitHub or any tracker. " +
          'Write the labels you would apply as JSON to `triage.json` (`{ "labels": [...] }`, using ' +
          "labels such as `type: bug` and `pkg: <package>`), and your assessment to `triage.md`.",
      ),
      teardown: [
        {
          action: "run_script",
          command: script("check-labels.ts", `--case ${c.id} --file triage.json`),
        },
      ],
      judge: [
        { check: "The assessment correctly says whether this is a real bug", weight: 2 },
        { check: `The assessment locates the affected area in ${c.packageDir}` },
        { check: "Severity and next steps are justified by the issue content" },
        NO_UPSTREAM_CHECK,
      ],
    })),
  };
}
