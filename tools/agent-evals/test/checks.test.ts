import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { checkHiddenTests } from "../scripts/check-hidden-tests.ts";
import { checkLabels } from "../scripts/check-labels.ts";
import { checkMentions } from "../scripts/check-mentions.ts";
import { checkMutation } from "../scripts/check-mutation.ts";
import { revertFixExtras } from "../scripts/revert-tests.ts";
import { readBaseline } from "../src/baseline.ts";
import { testCommand } from "../src/cases.ts";
import type { BugCase } from "../src/cases.ts";
import { addCheck, GRADE_PATH, gradePasses, readGrade } from "../src/grade.ts";
import { EXTRA_FILE, HIDDEN_TEST, workspaceWithFix } from "./helpers/workspace-with-fix.ts";

const tempDirs: string[] = [];
const tempDir = (prefix: string): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
};

afterAll(() => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

const runIn =
  (cwd: string) =>
  (command: string): number =>
    spawnSync(command, { cwd, shell: true }).status ?? 1;
const nodeTest = (files: string[]): string => `node --test ${files.join(" ")}`;

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
  issueLabels: ["pkg: cli", "type: bug", "status: triage"],
};

describe("grade", () => {
  it("accumulates checks and passes only when all pass", () => {
    const ws = tempDir("g-");
    addCheck(ws, { name: "a", pass: true, detail: "" });
    addCheck(ws, { name: "b", pass: false, detail: "nope" });
    const grade = readGrade(path.join(ws, GRADE_PATH));
    expect(grade?.checks.map((c) => c.name)).toEqual(["a", "b"]);
    expect(gradePasses(grade)).toBe(false);
  });

  it("passes when every check passes", () => {
    const ws = tempDir("g-");
    addCheck(ws, { name: "a", pass: true, detail: "" });
    expect(gradePasses(readGrade(path.join(ws, GRADE_PATH)))).toBe(true);
  });

  it("treats a missing grade as failing", () => {
    expect(readGrade("/nonexistent/grade.json")).toBeNull();
    expect(gradePasses(null)).toBe(false);
  });
});

describe("checkMutation", () => {
  it("passes when the new test fails without the fix", () => {
    const { workspace, mirror, c } = workspaceWithFix(CASE, {
      newTest: "expect(sum(1, 1)).toBe(2)",
    });
    const result = checkMutation({
      workspace,
      mirror,
      case: c,
      run: runIn(workspace),
      commandFor: nodeTest,
    });
    expect(result.map((r) => [r.name, r.pass])).toEqual([
      ["new-tests-exist", true],
      ["new-tests-pass-with-fix", true],
      ["new-tests-fail-without-fix", true],
    ]);
    expect(fs.readFileSync(path.join(workspace, "pkg/src/sum.mjs"), "utf8")).toContain("a + b");
  });

  it("fails when the new test also passes on the buggy source", () => {
    const { workspace, mirror, c } = workspaceWithFix(CASE, { newTest: "expect(1).toBe(1)" });
    const result = checkMutation({
      workspace,
      mirror,
      case: c,
      run: runIn(workspace),
      commandFor: nodeTest,
    });
    expect(result.find((r) => r.name === "new-tests-fail-without-fix")?.pass).toBe(false);
  });

  it("fails when the agent wrote no test", () => {
    const { workspace, mirror, c } = workspaceWithFix(CASE, {});
    const result = checkMutation({
      workspace,
      mirror,
      case: c,
      run: runIn(workspace),
      commandFor: nodeTest,
    });
    expect(result).toEqual([
      { name: "new-tests-exist", pass: false, detail: "no test files changed" },
    ]);
  });
});

describe("checkMutation file detection", () => {
  it("detects a test the agent committed", () => {
    const { workspace, mirror, c } = workspaceWithFix(CASE, {
      newTest: "expect(sum(1, 1)).toBe(2)",
    });
    execFileSync("git", ["add", "-A"], { cwd: workspace });
    execFileSync(
      "git",
      ["-c", "user.name=a", "-c", "user.email=a@e", "commit", "-q", "-m", "agent test"],
      { cwd: workspace },
    );
    const result = checkMutation({
      workspace,
      mirror,
      case: c,
      run: runIn(workspace),
      commandFor: nodeTest,
    });
    expect(result.map((r) => [r.name, r.pass])).toEqual([
      ["new-tests-exist", true],
      ["new-tests-pass-with-fix", true],
      ["new-tests-fail-without-fix", true],
    ]);
  });

  it("ignores a deleted test file", () => {
    const { workspace, mirror, c } = workspaceWithFix(CASE, {});
    fs.rmSync(path.join(workspace, HIDDEN_TEST));
    const result = checkMutation({
      workspace,
      mirror,
      case: c,
      run: runIn(workspace),
      commandFor: nodeTest,
    });
    expect(result).toEqual([
      { name: "new-tests-exist", pass: false, detail: "no test files changed" },
    ]);
  });

  it("records a failed check instead of throwing when a source file is gone", () => {
    const { workspace, mirror, c } = workspaceWithFix(CASE, { newTest: "expect(1).toBe(1)" });
    const result = checkMutation({
      workspace,
      mirror,
      case: { ...c, sourceFiles: ["pkg/src/sum.mjs", "pkg/src/missing.mjs"] },
      run: runIn(workspace),
      commandFor: nodeTest,
    });
    expect(result.at(-1)?.name).toBe("new-tests-fail-without-fix");
    expect(fs.existsSync(path.join(workspace, "pkg/src/missing.mjs"))).toBe(false);
  });
});

describe("testCommand", () => {
  it("shell-quotes file arguments", () => {
    const command = testCommand({ ...CASE, packageDir: "pkg" }, ["pkg/src/a b.test.ts"]);
    expect(command).toContain("'src/a b.test.ts'");
  });
});

describe("checkHiddenTests", () => {
  it("fails on the buggy source and passes once the agent fixed it", () => {
    const buggy = workspaceWithFix(CASE, { buggy: true });
    const failing = checkHiddenTests({
      workspace: buggy.workspace,
      mirror: buggy.mirror,
      case: buggy.c,
      run: runIn(buggy.workspace),
      commandFor: nodeTest,
    });
    expect(failing).toMatchObject({ name: "hidden-tests", pass: false });

    fs.writeFileSync(
      path.join(buggy.workspace, "pkg/src/sum.mjs"),
      "export const sum = (a, b) => a + b;\n",
    );
    const passing = checkHiddenTests({
      workspace: buggy.workspace,
      mirror: buggy.mirror,
      case: buggy.c,
      run: runIn(buggy.workspace),
      commandFor: nodeTest,
    });
    expect(passing).toMatchObject({ name: "hidden-tests", pass: true });
  });
});

describe("checkMentions", () => {
  it("passes when the report cites the package-relative or full path", () => {
    const ws = tempDir("m-");
    fs.writeFileSync(path.join(ws, "findings.md"), "Root cause is in `src/sum.mjs`, line 1.");
    expect(checkMentions({ workspace: ws, case: CASE, file: "findings.md" }).pass).toBe(true);
    fs.writeFileSync(path.join(ws, "findings.md"), "See pkg/src/sum.mjs.");
    expect(checkMentions({ workspace: ws, case: CASE, file: "findings.md" }).pass).toBe(true);
  });

  it("fails when the report only names the function", () => {
    const ws = tempDir("m-");
    fs.writeFileSync(path.join(ws, "findings.md"), "The sum function subtracts.");
    expect(checkMentions({ workspace: ws, case: CASE, file: "findings.md" }).pass).toBe(false);
  });

  it("fails when the report is missing", () => {
    const ws = tempDir("m-");
    expect(checkMentions({ workspace: ws, case: CASE, file: "findings.md" }).pass).toBe(false);
  });
});

describe("checkLabels", () => {
  it("requires pkg and type labels and ignores status labels", () => {
    const ws = tempDir("l-");
    fs.writeFileSync(
      path.join(ws, "triage.json"),
      JSON.stringify({ labels: ["type: bug", "pkg: cli"] }),
    );
    expect(checkLabels({ workspace: ws, case: CASE, file: "triage.json" }).pass).toBe(true);
    fs.writeFileSync(path.join(ws, "triage.json"), JSON.stringify({ labels: ["type: bug"] }));
    expect(checkLabels({ workspace: ws, case: CASE, file: "triage.json" }).pass).toBe(false);
  });
});

describe("revertFixExtras", () => {
  it("restores the hidden test to its pre-fix contents and leaves a clean tree", () => {
    const { workspace, mirror, c } = workspaceWithFix(CASE, {});
    expect(fs.existsSync(path.join(workspace, HIDDEN_TEST))).toBe(true);
    revertFixExtras({ workspace, mirror, case: c });
    expect(fs.existsSync(path.join(workspace, HIDDEN_TEST))).toBe(false);
    const status = execFileSync("git", ["status", "--porcelain"], {
      cwd: workspace,
      encoding: "utf8",
    });
    expect(status).toBe("");
  });

  it("also removes non-test files the fix added, and keeps the fixed source", () => {
    const { workspace, mirror, c } = workspaceWithFix(CASE, {});
    expect(fs.existsSync(path.join(workspace, EXTRA_FILE))).toBe(true);
    revertFixExtras({ workspace, mirror, case: c });
    expect(fs.existsSync(path.join(workspace, EXTRA_FILE))).toBe(false);
    expect(fs.readFileSync(path.join(workspace, "pkg/src/sum.mjs"), "utf8")).toContain("a + b");
  });

  it("moves the grading baseline past the revert", () => {
    const { workspace, mirror, c } = workspaceWithFix(CASE, {});
    revertFixExtras({ workspace, mirror, case: c });
    expect(readBaseline(workspace)).toBe(
      execFileSync("git", ["rev-parse", "HEAD"], { cwd: workspace, encoding: "utf8" }).trim(),
    );
  });
});
