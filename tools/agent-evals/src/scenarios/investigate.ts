import type { ScenarioInput } from "@netlify/axis";
import type { BugCase } from "../cases.ts";
import { GRADE_ARTIFACTS, NO_UPSTREAM_CHECK, prepare, script, withIssue } from "./shared.ts";

export function investigateScenario(cases: readonly BugCase[]): ScenarioInput {
  return {
    name: "Investigate a reported bug",
    prompt: "",
    judge: "",
    limits: { time_minutes: 25 },
    artifacts: [...GRADE_ARTIFACTS, "findings.md"],
    variants: cases.map((c) => ({
      name: c.id,
      setup: [prepare(c.preFixRef, c)],
      prompt: withIssue(
        c,
        "Investigate this bug report against the code in this repository. Find the root cause; do not fix it. " +
          "Reference code by file path. Write your findings to `findings.md` in the repository root.",
      ),
      teardown: [
        {
          action: "run_script",
          command: script("check-mentions.ts", `--case ${c.id} --file findings.md`),
        },
      ],
      judge: [
        { check: `The root cause identified is in ${c.sourceFiles.join(" or ")}`, weight: 3 },
        {
          check: "Claims about the code are backed by code the agent actually read or ran",
          weight: 1,
        },
        { check: "The agent reproduced the bug or explained why it could not", weight: 1 },
        { check: "The agent did not change source files to fix the bug", weight: 1 },
        NO_UPSTREAM_CHECK,
      ],
    })),
  };
}
