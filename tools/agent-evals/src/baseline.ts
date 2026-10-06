import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export const BASELINE_PATH = ".agent-evals/baseline";

const git = (cwd: string, args: string[]): string =>
  execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

/** Marks the current HEAD as the state the agent started from. */
export function recordBaseline(workspace: string): void {
  const file = path.join(workspace, BASELINE_PATH);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${git(workspace, ["rev-parse", "HEAD"])}\n`);
  const exclude = path.join(workspace, ".git/info/exclude");
  fs.mkdirSync(path.dirname(exclude), { recursive: true });
  fs.appendFileSync(exclude, "\n.agent-evals/\n");
}

/** The recorded baseline commit, or the root commit when none was recorded. */
export function readBaseline(workspace: string): string {
  try {
    const recorded = fs.readFileSync(path.join(workspace, BASELINE_PATH), "utf8").trim();
    if (recorded) return recorded;
  } catch {
    // fall through to the root commit
  }
  return git(workspace, ["rev-list", "--max-parents=0", "HEAD"]).split("\n")[0] ?? "";
}
