import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { recordBaseline } from "../src/baseline.ts";
import { bugCase } from "../src/cases.ts";
import type { BugCase } from "../src/cases.ts";
import { defaultMirror } from "./check-mutation.ts";

const git = (cwd: string, args: string[]): string =>
  execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

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

/** Files the fix commit changed besides the fixed sources and test setup: its tests and fixtures. */
function fixExtras(mirror: string, c: BugCase): string[] {
  const kept = new Set([...c.sourceFiles, ...c.testSetupFiles]);
  return git(mirror, ["diff", "--name-only", c.preFixRef, c.fixRef])
    .split("\n")
    .filter((file) => file && !kept.has(file));
}

/** Resets everything the fix changed except its sources to pre-fix contents, so the tree has the fix but not its tests. */
export function revertFixExtras(ctx: { workspace: string; mirror: string; case: BugCase }): void {
  for (const file of fixExtras(ctx.mirror, ctx.case)) {
    const full = path.join(ctx.workspace, file);
    const before = sourceAt(ctx.mirror, ctx.case.preFixRef, file);
    if (before === null) {
      fs.rmSync(full, { force: true });
    } else {
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, before);
    }
  }
  git(ctx.workspace, ["add", "-A"]);
  if (git(ctx.workspace, ["status", "--porcelain"])) {
    // --no-verify: pnpm install activates the repo's husky hooks, which must not run here.
    git(ctx.workspace, [
      "-c",
      "user.name=eval",
      "-c",
      "user.email=eval@example.com",
      "commit",
      "-q",
      "--no-verify",
      "-m",
      "test: baseline",
    ]);
  }
  recordBaseline(ctx.workspace);
}

if (import.meta.main) {
  const { values } = parseArgs({ options: { case: { type: "string" } } });
  revertFixExtras({
    workspace: process.cwd(),
    mirror: defaultMirror(),
    case: bugCase(values.case ?? ""),
  });
}
