import fs from "node:fs";
import path from "node:path";
import type { ScenarioInput } from "@netlify/axis";
import { EVALS_DIR } from "../arms.ts";
import type { BugCase } from "../cases.ts";
import {
  GRADE_ARTIFACTS,
  NO_UPSTREAM_CHECK,
  armVariants,
  invokeSkill,
  prepare,
  script,
  withIssue,
} from "./shared.ts";

/** superpowers has no triage skill, so that arm gets the plain task. */
const SKILLS = { monoblok: "triage" };

export function readIssueLabels(file: string): string[] {
  const parsed: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!Array.isArray(parsed) || !parsed.every((label) => typeof label === "string")) {
    throw new Error(`${file} must be a JSON array of label strings`);
  }
  return parsed;
}

const ISSUE_LABELS = readIssueLabels(path.join(EVALS_DIR, "fixtures/labels.json"));

export function triageScenario(cases: readonly BugCase[]): ScenarioInput {
  return {
    name: "Triage an issue",
    prompt: "",
    judge: "",
    limits: { time_minutes: 15 },
    artifacts: [...GRADE_ARTIFACTS, "triage.json", "triage.md"],
    variants: armVariants(cases, (c, arm) => ({
      setup: [prepare(c.preFixRef, c, { install: false })],
      prompt: invokeSkill(
        arm,
        SKILLS,
        withIssue(
          c,
          "Triage this GitHub issue for the monoblok repository. Do not modify GitHub or any tracker. " +
            'Write the labels you would apply as JSON to `triage.json` (`{ "labels": [...] }`) and your assessment to `triage.md`. ' +
            `Choose labels only from: ${ISSUE_LABELS.join(", ")}.`,
        ),
      ),
      teardown: [
        {
          action: "run_script",
          command: script("check-labels.ts", `--case ${c.id} --file triage.json`),
        },
      ],
      judge: [
        { check: "The assessment correctly says whether this is a real bug", weight: 2 },
        { check: `The assessment locates the affected area in ${c.packageDir}`, weight: 1 },
        { check: "Severity and next steps are justified by the issue content", weight: 1 },
        NO_UPSTREAM_CHECK,
      ],
    })),
  };
}
