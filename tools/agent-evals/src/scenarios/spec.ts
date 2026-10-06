import fs from "node:fs";
import path from "node:path";
import type { ScenarioInput } from "@netlify/axis";
import type { ArmName } from "../arms.ts";
import { ARM_NAMES, EVALS_DIR, armHasMonoblok } from "../arms.ts";
import { variantName } from "../case-key.ts";
import type { SpecCase } from "../spec-cases.ts";
import { script } from "./shared.ts";

function request(c: SpecCase): string {
  return fs.readFileSync(path.join(EVALS_DIR, "fixtures/requests", `${c.id}.md`), "utf8").trim();
}

const SAVE_INSTRUCTION = "Save it as a Markdown file in this repository.";
const BARE_SAVE_INSTRUCTION = "Save it as a Markdown file under `claude-output/`.";

function promptFor(arm: ArmName, requestText: string): string {
  if (armHasMonoblok(arm)) return `/spec ${requestText}`;
  if (arm === "superpowers") {
    return `/superpowers:brainstorming ${SAVE_INSTRUCTION}\n\n${requestText}`;
  }
  return `Write a spec for this request, ready to hand to a developer. ${BARE_SAVE_INSTRUCTION}\n\n${requestText}`;
}

export function specScenario(cases: readonly SpecCase[]): ScenarioInput {
  return {
    name: "Write a spec",
    prompt: "",
    judge: "",
    limits: { time_minutes: 30 },
    artifacts: ["claude-output/**", "docs/superpowers/**"],
    variants: cases.flatMap((c) =>
      ARM_NAMES.map((arm) => ({
        name: variantName(c.id, arm),
        agents: [arm],
        setup: [
          {
            action: "run_script" as const,
            command: script("prepare-workspace.ts", `--ref ${c.preFixRef}`),
          },
        ],
        prompt: promptFor(arm, request(c)),
        judge: [
          {
            check:
              "A spec file was written and covers the user-facing contract (commands, flags, props, output, errors)",
            weight: 3,
          },
          { check: `The spec's contract matches what shipped: ${c.shipped}`, weight: 2 },
          {
            check: "The spec states the decisions the requester gave when asked, accurately",
            weight: 1,
          },
          {
            check: "Questions to the requester were relevant and answerable by them",
            weight: 2,
          },
          { check: "The spec does not prescribe internal implementation details", weight: 1 },
          { check: "Acceptance criteria are concrete and checkable", weight: 1 },
          { check: "Open questions that remain are surfaced, not silently decided", weight: 1 },
        ],
      })),
    ),
  };
}
