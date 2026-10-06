import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { revertFixExtras } from "../scripts/revert-tests.ts";
import { buildReviewBranch } from "../scripts/build-review-branch.ts";
import { readBaseline } from "../src/baseline.ts";
import type { BugCase } from "../src/cases.ts";
import {
  HIDDEN_TEST,
  NOISE_FILE,
  NOISE_SUBJECT,
  workspaceWithFix,
} from "./helpers/workspace-with-fix.ts";

const git = (cwd: string, ...args: string[]): string =>
  execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

const CASE: BugCase = {
  id: "t",
  issue: 1,
  packageDir: "pkg",
  packageName: "pkg",
  fixRef: "",
  preFixRef: "",
  sourceFiles: ["pkg/src/sum.mjs"],
  testFiles: [HIDDEN_TEST],
  testSetupFiles: [],
  testRunner: "vitest",
  issueLabels: [],
};

describe("buildReviewBranch", () => {
  it("reintroduces the bug alongside an unrelated change on a `feature` branch", () => {
    const { workspace, mirror, c } = workspaceWithFix(CASE, {});
    revertFixExtras({ workspace, mirror, case: c });
    const noise = buildReviewBranch({ workspace, mirror, case: c, mainRef: "refs/heads/main" });

    expect(git(workspace, "branch", "--show-current")).toBe("feature");
    expect(git(workspace, "log", "main..feature", "--format=%s")).toBe(NOISE_SUBJECT);
    expect(noise).toBe(git(mirror, "rev-parse", "refs/heads/main"));

    const diff = git(workspace, "diff", "main..feature");
    expect(diff).toContain("-export const sum = (a, b) => a + b;");
    expect(diff).toContain("+export const sum = (a, b) => a - b;");
    expect(diff).toContain(NOISE_FILE);
    expect(fs.readFileSync(path.join(workspace, "pkg/src/sum.mjs"), "utf8")).toContain("a - b");
    for (const branch of ["main", "feature"]) {
      expect(git(workspace, "ls-tree", "-r", "--name-only", branch)).not.toContain(HIDDEN_TEST);
    }
  });

  it("moves the grading baseline to the feature commit", () => {
    const { workspace, mirror, c } = workspaceWithFix(CASE, {});
    buildReviewBranch({ workspace, mirror, case: c, mainRef: "refs/heads/main" });
    expect(readBaseline(workspace)).toBe(git(workspace, "rev-parse", "HEAD"));
  });

  it("fails when no later commit can serve as the unrelated change", () => {
    const { workspace, mirror, c } = workspaceWithFix(CASE, {});
    expect(() =>
      buildReviewBranch({
        workspace,
        mirror,
        case: { ...c, packageDir: "other" },
        mainRef: "refs/heads/main",
      }),
    ).toThrow(/noise/i);
  });
});
