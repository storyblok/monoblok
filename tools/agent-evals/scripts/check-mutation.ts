import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { EVALS_DIR } from "../src/arms.ts";
import { bugCase, testCommand } from "../src/cases.ts";
import type { BugCase } from "../src/cases.ts";
import { addCheck } from "../src/grade.ts";
import type { Check } from "../src/grade.ts";

const TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$|\.test-d\.ts$/;

export type CheckContext = {
  workspace: string;
  mirror: string;
  case: BugCase;
  run: (command: string) => number;
  commandFor?: (files: string[]) => string;
};

export const defaultMirror = (): string =>
  path.join(process.env.AXIS_CONFIG_DIR ?? EVALS_DIR, ".cache", "monoblok.git");

export function shellRunner(cwd: string): (command: string) => number {
  return (command) => spawnSync(command, { cwd, shell: true, stdio: "inherit" }).status ?? 1;
}

function changedTestFiles(workspace: string): string[] {
  const out = execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], {
    cwd: workspace,
    encoding: "utf8",
  });
  return out
    .split("\n")
    .map((line) => line.slice(3).trim())
    .filter((file) => TEST_FILE.test(file));
}

export function checkMutation(ctx: CheckContext): Check[] {
  const files = changedTestFiles(ctx.workspace);
  if (files.length === 0) {
    return [{ name: "new-tests-exist", pass: false, detail: "no test files changed" }];
  }
  const command = (ctx.commandFor ?? ((f: string[]) => testCommand(ctx.case, f)))(files);
  const checks: Check[] = [{ name: "new-tests-exist", pass: true, detail: files.join(", ") }];

  const withFix = ctx.run(command);
  checks.push({ name: "new-tests-pass-with-fix", pass: withFix === 0, detail: `exit ${withFix}` });
  if (withFix !== 0) return checks;

  const originals = new Map(
    ctx.case.sourceFiles.map((f) => [f, fs.readFileSync(path.join(ctx.workspace, f), "utf8")]),
  );
  try {
    for (const file of ctx.case.sourceFiles) {
      const before = execFileSync("git", ["show", `${ctx.case.preFixRef}:${file}`], {
        cwd: ctx.mirror,
        encoding: "utf8",
      });
      fs.writeFileSync(path.join(ctx.workspace, file), before);
    }
    const withoutFix = ctx.run(command);
    checks.push({
      name: "new-tests-fail-without-fix",
      pass: withoutFix !== 0,
      detail: `exit ${withoutFix}`,
    });
  } finally {
    for (const [file, content] of originals) {
      fs.writeFileSync(path.join(ctx.workspace, file), content);
    }
  }
  return checks;
}

if (import.meta.main) {
  const { values } = parseArgs({ options: { case: { type: "string" } } });
  const workspace = process.cwd();
  const ctx: CheckContext = {
    workspace,
    mirror: defaultMirror(),
    case: bugCase(values.case ?? ""),
    run: shellRunner(workspace),
  };
  for (const check of checkMutation(ctx)) addCheck(workspace, check);
}
