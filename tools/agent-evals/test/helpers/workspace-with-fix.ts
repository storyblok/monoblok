import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll } from "vitest";
import { prepareWorkspace } from "../../scripts/prepare-workspace.ts";
import type { BugCase } from "../../src/cases.ts";

const tempDirs: string[] = [];
const tempDir = (prefix: string): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
};

afterAll(() => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

const git = (cwd: string, ...args: string[]): string =>
  execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

const HARNESS = (body: string): string => `import { test } from "node:test";
import assert from "node:assert/strict";
import { sum } from "./sum.mjs";
const expect = (v) => ({ toBe: (w) => assert.equal(v, w) });
test("sum", () => { ${body} });
`;

export const EXTRA_FILE = "pkg/e2e/extra.fixture.mjs";
export const HIDDEN_TEST = "pkg/src/sum.hidden.test.mjs";

type Options = {
  /** Body of a test the agent wrote into the workspace. */
  newTest?: string;
  /** Prepare the workspace at the buggy commit instead of the fix. */
  buggy?: boolean;
  /** Commit message of the workspace snapshot; defaults to the upstream message. */
  message?: string;
  /** The fix also bumps a dependency in a package manifest and the lockfile. */
  dependencyChange?: boolean;
};

function writeDependencyVersion(repo: string, version: string): void {
  const manifest = { name: "pkg", dependencies: { dep: version } };
  fs.writeFileSync(path.join(repo, "pkg/package.json"), JSON.stringify(manifest));
  fs.writeFileSync(path.join(repo, "pnpm-lock.yaml"), `dep: ${version}\n`);
}

export const FIX_SUBJECT = "fix: add instead of subtracting in sum";
export const NOISE_FILE = "pkg/src/greet.mjs";
export const NOISE_SUBJECT = "feat: add greet helper";

/**
 * Builds a mirror (buggy, fixed with a hidden test, then an unrelated change) and a workspace at
 * the fix or, with `buggy`, at the buggy commit.
 */
export function workspaceWithFix(
  c: BugCase,
  options: Options,
): { workspace: string; mirror: string; c: BugCase } {
  const repo = tempDir("fix-repo-");
  git(repo, "init", "-q", "-b", "main");
  git(repo, "config", "user.email", "t@example.com");
  git(repo, "config", "user.name", "t");
  fs.mkdirSync(path.join(repo, "pkg/src"), { recursive: true });
  fs.writeFileSync(path.join(repo, "pkg/src/sum.mjs"), "export const sum = (a, b) => a - b;\n");
  writeDependencyVersion(repo, "1.0.0");
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "buggy");
  const preFixRef = git(repo, "rev-parse", "HEAD");
  fs.writeFileSync(path.join(repo, "pkg/src/sum.mjs"), "export const sum = (a, b) => a + b;\n");
  fs.writeFileSync(path.join(repo, HIDDEN_TEST), HARNESS("expect(sum(2, 3)).toBe(5);"));
  fs.mkdirSync(path.join(repo, "pkg/e2e"), { recursive: true });
  fs.writeFileSync(path.join(repo, EXTRA_FILE), "export default 1;\n");
  if (options.dependencyChange) writeDependencyVersion(repo, "2.0.0");
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", FIX_SUBJECT);
  const fixRef = git(repo, "rev-parse", "HEAD");
  fs.writeFileSync(path.join(repo, NOISE_FILE), "export const greet = () => 'hi';\n");
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", NOISE_SUBJECT);

  const mirror = `${repo}-mirror.git`;
  tempDirs.push(mirror);
  execFileSync("git", ["clone", "-q", "--mirror", repo, mirror]);

  const workspace = tempDir("fix-ws-");
  prepareWorkspace({
    mirror,
    ref: options.buggy ? preFixRef : fixRef,
    workspace,
    message: options.message,
  });
  if (options.newTest !== undefined) {
    fs.writeFileSync(path.join(workspace, "pkg/src/sum.test.mjs"), HARNESS(options.newTest));
  }
  return { workspace, mirror, c: { ...c, preFixRef, fixRef } };
}
