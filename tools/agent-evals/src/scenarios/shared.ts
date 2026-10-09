import fs from "node:fs";
import path from "node:path";
import type { ScenarioVariant } from "@netlify/axis";
import { ARM_NAMES, EVALS_DIR, armHasMonoblok } from "../arms.ts";
import type { ArmName } from "../arms.ts";
import { variantName } from "../case-key.ts";
import { shellQuote } from "../cases.ts";
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

/** Commit message for workspaces exported at the fix, so `git log` does not describe the fix. */
export const NEUTRAL_MESSAGE = "chore: snapshot";

export function prepare(
  ref: string,
  c: BugCase,
  { install = true, message }: { install?: boolean; message?: string } = {},
): { action: "run_script"; command: string } {
  const installFlag = install ? "" : " --no-install";
  const messageFlag = message ? ` --message ${shellQuote(message)}` : "";
  return {
    action: "run_script",
    command: script(
      "prepare-workspace.ts",
      `--ref ${ref} --case ${c.id}${installFlag}${messageFlag}`,
    ),
  };
}

/** The skill each arm invokes for a task. An arm without a matching skill gets the plain task. */
export type ArmSkills = { monoblok?: string; superpowers?: string };

export function invokeSkill(arm: ArmName, skills: ArmSkills, task: string): string {
  if (armHasMonoblok(arm) && skills.monoblok) return `/${skills.monoblok} ${task}`;
  if (arm === "superpowers" && skills.superpowers) {
    return `/superpowers:${skills.superpowers} ${task}`;
  }
  return task;
}

/** One variant per case and arm, each restricted to its arm. */
export function armVariants<C extends { id: string }>(
  cases: readonly C[],
  variantFor: (c: C, arm: ArmName) => Omit<ScenarioVariant, "name" | "agents">,
): ScenarioVariant[] {
  return cases.flatMap((c) =>
    ARM_NAMES.map((arm) => ({
      ...variantFor(c, arm),
      name: variantName(c.id, arm),
      agents: [arm],
    })),
  );
}
