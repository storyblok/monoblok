import type { ScenarioInput } from "@netlify/axis";
import type { BugCase } from "../cases.ts";
import { GRADE_ARTIFACTS, NO_UPSTREAM_CHECK, prepare, script, withIssue } from "./shared.ts";

export function planImplementScenario(cases: readonly BugCase[]): ScenarioInput {
  return {
    name: "Plan and implement a bug fix",
    prompt: "",
    judge: "",
    limits: { time_minutes: 40 },
    artifacts: [...GRADE_ARTIFACTS],
    variants: cases.map((c) => ({
      name: c.id,
      setup: [prepare(c.preFixRef, c)],
      prompt: withIssue(
        c,
        "Fix this bug. Plan the change first, then implement it with tests, and verify it with the " +
          "package's lint, type-check, and tests. Do not commit.",
      ),
      teardown: [
        { action: "run_script", command: script("check-hidden-tests.ts", `--case ${c.id}`) },
      ],
      judge: [
        { check: "The agent wrote a plan before editing code", weight: 1 },
        {
          check: `The fix changes behavior in ${c.sourceFiles.join(" or ")} or code they call`,
          weight: 2,
        },
        { check: "The diff stays scoped to the bug; no unrelated refactors" },
        { check: "The agent added tests covering the reported behavior" },
        { check: "The agent ran lint, type-check, and tests and reported their real results" },
        NO_UPSTREAM_CHECK,
      ],
    })),
  };
}
