import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { prepareWorkspace } from "../scripts/prepare-workspace.ts";

const git = (cwd: string, ...args: string[]): string =>
  execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

function historyRepo(): { mirror: string; oldRef: string; newRef: string } {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "history-"));
  git(repo, "init", "-q", "-b", "main");
  git(repo, "config", "user.email", "t@example.com");
  git(repo, "config", "user.name", "t");
  fs.mkdirSync(path.join(repo, ".agents/skills/plan"), { recursive: true });
  fs.writeFileSync(path.join(repo, ".agents/skills/plan/SKILL.md"), "# plan");
  fs.mkdirSync(path.join(repo, ".claude/agents"), { recursive: true });
  fs.writeFileSync(path.join(repo, ".claude/agents/reviewer.md"), "# reviewer");
  fs.symlinkSync("../.agents/skills", path.join(repo, ".claude/skills"));
  fs.writeFileSync(path.join(repo, "AGENTS.md"), "# rules");
  fs.writeFileSync(path.join(repo, "bug.ts"), "export const x = 1;\n");
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "before fix");
  const oldRef = git(repo, "rev-parse", "HEAD");
  fs.writeFileSync(path.join(repo, "bug.ts"), "export const x = 2; // THE FIX\n");
  git(repo, "commit", "-qam", "fix: the fix");
  const newRef = git(repo, "rev-parse", "HEAD");
  const mirror = `${repo}-mirror.git`;
  execFileSync("git", ["clone", "-q", "--mirror", repo, mirror]);
  return { mirror, oldRef, newRef };
}

describe("prepareWorkspace", () => {
  it("exports the tree at ref as a one-commit repo without skills or future history", () => {
    const { mirror, oldRef, newRef } = historyRepo();
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "ws-"));
    prepareWorkspace({ mirror, ref: oldRef, workspace });

    expect(fs.readFileSync(path.join(workspace, "bug.ts"), "utf8")).toBe("export const x = 1;\n");
    expect(git(workspace, "rev-list", "--all", "--count")).toBe("1");
    expect(() => git(workspace, "cat-file", "-e", newRef)).toThrow();
    expect(git(workspace, "log", "-1", "--format=%s")).toBe("before fix");
    expect(git(workspace, "status", "--porcelain")).toBe("");
    expect(fs.existsSync(path.join(workspace, ".agents/skills"))).toBe(false);
    expect(fs.existsSync(path.join(workspace, ".claude/skills"))).toBe(false);
    expect(fs.existsSync(path.join(workspace, ".claude/agents"))).toBe(false);
    expect(fs.existsSync(path.join(workspace, "AGENTS.md"))).toBe(true);
  });

  it("fails loudly on an unknown ref", () => {
    const { mirror } = historyRepo();
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "ws-"));
    expect(() => prepareWorkspace({ mirror, ref: "0".repeat(40), workspace })).toThrow();
  });
});
