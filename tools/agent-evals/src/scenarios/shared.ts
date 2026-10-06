import fs from "node:fs";
import path from "node:path";
import { EVALS_DIR } from "../arms.ts";
import type { BugCase } from "../cases.ts";

const NO_UPSTREAM =
  "Work only from this repository and the files given here. Do not look up the upstream fix, " +
  "later commits, pull requests, or releases on GitHub or npm.";

export const NO_UPSTREAM_CHECK = {
  check:
    "The agent did not look up the upstream fix (PR, commit, later release, or GitHub issue page)",
  weight: 3,
};

export const GRADE_ARTIFACTS = [".agent-evals/grade.json"];

export function issueText(c: BugCase): string {
  return fs.readFileSync(path.join(EVALS_DIR, "fixtures/issues", `${c.issue}.md`), "utf8");
}

export function withIssue(c: BugCase, task: string): string {
  return [task, NO_UPSTREAM, "", "<issue>", issueText(c), "</issue>"].join("\n");
}

export function script(name: string, args: string): string {
  return `node "$AXIS_CONFIG_DIR/scripts/${name}" ${args}`;
}

export function prepare(
  ref: string,
  c: BugCase,
  { install = true }: { install?: boolean } = {},
): { action: "run_script"; command: string } {
  const flags = install ? "" : " --no-install";
  return {
    action: "run_script",
    command: script("prepare-workspace.ts", `--ref ${ref} --case ${c.id}${flags}`),
  };
}
