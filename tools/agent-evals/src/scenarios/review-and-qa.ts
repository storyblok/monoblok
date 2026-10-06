import type { ScenarioInput } from "@netlify/axis";
import type { BugCase } from "../cases.ts";
import { GRADE_ARTIFACTS, prepare, script } from "./shared.ts";

export function reviewAndQaScenario(cases: readonly BugCase[]): ScenarioInput {
  return {
    name: "Review a branch",
    prompt: "",
    judge: "",
    limits: { time_minutes: 25 },
    artifacts: [...GRADE_ARTIFACTS, "review.md"],
    variants: cases.map((c) => ({
      name: c.id,
      setup: [
        prepare(c.fixRef, c),
        { action: "run_script", command: script("revert-tests.ts", `--case ${c.id}`) },
        { action: "run_script", command: script("build-review-branch.ts", `--case ${c.id}`) },
      ],
      prompt:
        "Review the changes on the current branch `feature` against `main` and produce a QA plan. " +
        "Reference code by file path. Write the review to `review.md` in the repository root. " +
        "Work only from this repository; do not look up these changes on GitHub.",
      teardown: [
        {
          action: "run_script",
          command: script("check-mentions.ts", `--case ${c.id} --file review.md`),
        },
      ],
      judge: [
        {
          check: `The review flags the regression in ${c.sourceFiles.join(" or ")} as a defect`,
          weight: 3,
        },
        { check: "The review explains the user-visible impact of that regression", weight: 1 },
        { check: "The review has few or no findings that are wrong or irrelevant", weight: 2 },
        { check: "The QA plan has concrete steps that would catch the regression", weight: 1 },
      ],
    })),
  };
}
