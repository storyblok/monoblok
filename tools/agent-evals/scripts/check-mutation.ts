import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { EVALS_DIR } from "../src/arms.ts";
import { readBaseline } from "../src/baseline.ts";
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

const gitLines = (cwd: string, args: string[]): string[] =>
  execFileSync("git", args, { cwd, encoding: "utf8" }).split("\0").filter(Boolean);

/** Test files added, modified, or renamed since the baseline, committed or not. */
function changedTestFiles(workspace: string): string[] {
  const tracked = gitLines(workspace, [
    "diff",
    "--name-only",
    "-z",
    "--diff-filter=AMR",
    readBaseline(workspace),
  ]);
  const untracked = gitLines(workspace, ["ls-files", "--others", "--exclude-standard", "-z"]);
  return [...new Set([...tracked, ...untracked])].filter((file) => TEST_FILE.test(file));
}

/** File content at `ref`, or null when the file did not exist there. */
function sourceAt(mirror: string, ref: string, file: string): string | null {
  try {
    return execFileSync("git", ["show", `${ref}:${file}`], {
      cwd: mirror,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return null;
  }
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

  const originals = new Map<string, string | null>();
  try {
    for (const file of ctx.case.sourceFiles) {
      const full = path.join(ctx.workspace, file);
      originals.set(file, fs.existsSync(full) ? fs.readFileSync(full, "utf8") : null);
      const before = sourceAt(ctx.mirror, ctx.case.preFixRef, file);
      if (before === null) fs.rmSync(full, { force: true });
      else fs.writeFileSync(full, before);
    }
    const withoutFix = ctx.run(command);
    checks.push({
      name: "new-tests-fail-without-fix",
      pass: withoutFix !== 0,
      detail: `exit ${withoutFix}`,
    });
  } catch (error) {
    checks.push({
      name: "new-tests-fail-without-fix",
      pass: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  } finally {
    for (const [file, content] of originals) {
      const full = path.join(ctx.workspace, file);
      if (content === null) fs.rmSync(full, { force: true });
      else fs.writeFileSync(full, content);
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
