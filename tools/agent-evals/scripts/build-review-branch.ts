import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { parseArgs } from "node:util";
import { recordBaseline } from "../src/baseline.ts";
import { bugCase } from "../src/cases.ts";
import type { BugCase } from "../src/cases.ts";
import { defaultMirror } from "./check-mutation.ts";

const BRANCH = "feature";

type Options = { workspace: string; mirror: string; case: BugCase; mainRef: string };

const git = (cwd: string, args: string[]): string =>
  execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

const gitRaw = (cwd: string, args: string[]): string =>
  execFileSync("git", args, { cwd, encoding: "utf8" });

function applies(workspace: string, diff: string, check: boolean): boolean {
  try {
    execFileSync("git", ["apply", ...(check ? ["--check"] : []), "-"], {
      cwd: workspace,
      input: diff,
      stdio: ["pipe", "ignore", "ignore"],
    });
    return true;
  } catch {
    return false;
  }
}

/** The first later commit touching the package, but not the fixed files, that applies on top of the regression. */
function findNoiseCommit(o: Options): { sha: string; diff: string } | undefined {
  const shas = git(o.mirror, [
    "rev-list",
    "--reverse",
    `${o.case.fixRef}..${o.mainRef}`,
    "--",
    o.case.packageDir,
  ])
    .split("\n")
    .filter(Boolean);
  for (const sha of shas) {
    const touched = git(o.mirror, ["diff", "--name-only", `${sha}^`, sha, "--", o.case.packageDir])
      .split("\n")
      .filter(Boolean);
    if (
      touched.length === 0 ||
      touched.some((f) => o.case.sourceFiles.includes(f) || o.case.testFiles.includes(f))
    ) {
      continue;
    }
    const diff = gitRaw(o.mirror, ["diff", `${sha}^`, sha, "--", o.case.packageDir]);
    if (applies(o.workspace, diff, true)) return { sha, diff };
  }
  return undefined;
}

/**
 * Creates a `feature` branch off the fixed workspace that reintroduces the bug next to an
 * unrelated upstream change, and returns that change's sha.
 */
export function buildReviewBranch(o: Options): string {
  git(o.workspace, ["switch", "-q", "-c", BRANCH]);
  const regression = gitRaw(o.mirror, [
    "diff",
    o.case.fixRef,
    o.case.preFixRef,
    "--",
    ...o.case.sourceFiles,
  ]);
  if (!applies(o.workspace, regression, false)) {
    throw new Error("Could not reintroduce the regression");
  }
  const noise = findNoiseCommit(o);
  if (!noise)
    throw new Error(`No noise commit found after ${o.case.fixRef} in ${o.case.packageDir}`);
  if (!applies(o.workspace, noise.diff, false)) throw new Error("Could not apply the noise commit");

  const subject = git(o.mirror, ["log", "-1", "--format=%s", noise.sha]);
  git(o.workspace, ["add", "-A"]);
  // --no-verify: pnpm install activates the repo's husky hooks, which must not run here.
  git(o.workspace, [
    "-c",
    "user.name=eval",
    "-c",
    "user.email=eval@example.com",
    "commit",
    "-q",
    "--no-verify",
    "-m",
    subject,
  ]);
  recordBaseline(o.workspace);
  return noise.sha;
}

if (import.meta.main) {
  const { values } = parseArgs({ options: { case: { type: "string" } } });
  const sha = buildReviewBranch({
    workspace: process.cwd(),
    mirror: defaultMirror(),
    case: bugCase(values.case ?? ""),
    mainRef: "refs/heads/main",
  });
  if (process.env.AXIS_OUTPUT) fs.appendFileSync(process.env.AXIS_OUTPUT, `noise commit: ${sha}\n`);
}
