import type { ScenarioInput } from "@netlify/axis";
import type { BugCase } from "../cases.ts";
import { GRADE_ARTIFACTS, NO_UPSTREAM_CHECK, prepare, script, withIssue } from "./shared.ts";

export function qaEngineerUnitScenario(cases: readonly BugCase[]): ScenarioInput {
  return {
    name: "Add a regression test for a fixed bug",
    prompt: "",
    judge: "",
    limits: { time_minutes: 25 },
    artifacts: [...GRADE_ARTIFACTS],
    variants: cases.map((c) => ({
      name: c.id,
      setup: [
        prepare(c.fixRef, c),
        { action: "run_script", command: script("revert-tests.ts", `--case ${c.id}`) },
      ],
      prompt: withIssue(
        c,
        "This bug has been fixed in the current code. Add unit tests that would have caught it, " +
          "following the package's existing test conventions. Run them.",
      ),
      teardown: [{ action: "run_script", command: script("check-mutation.ts", `--case ${c.id}`) }],
      judge: [
        {
          check: "The new tests exercise the reported behavior through the package's public API",
          weight: 2,
        },
        { check: "The tests assert observable behavior, not implementation details" },
        { check: "The tests follow the file layout and style of the package's existing tests" },
        { check: "The agent ran the new tests and they passed" },
        NO_UPSTREAM_CHECK,
      ],
    })),
  };
}
