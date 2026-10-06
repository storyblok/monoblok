import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { prepareWorkspace } from "../scripts/prepare-workspace.ts";

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

function historyRepo(): { mirror: string; oldRef: string; newRef: string } {
  const repo = tempDir("history-");
  git(repo, "init", "-q", "-b", "main");
  git(repo, "config", "user.email", "t@example.com");
  git(repo, "config", "user.name", "t");
  fs.mkdirSync(path.join(repo, ".agents/skills/plan"), { recursive: true });
  fs.writeFileSync(path.join(repo, ".agents/skills/plan/SKILL.md"), "# plan");
  fs.mkdirSync(path.join(repo, ".claude/agents"), { recursive: true });
  fs.writeFileSync(path.join(repo, ".claude/agents/reviewer.md"), "# reviewer");
  fs.symlinkSync("../.agents/skills", path.join(repo, ".claude/skills"));
  fs.writeFileSync(path.join(repo, ".claude/settings.json"), "{}");
  fs.mkdirSync(path.join(repo, "pkg/.claude/skills/x"), { recursive: true });
  fs.writeFileSync(path.join(repo, "pkg/.claude/skills/x/SKILL.md"), "# x");
  fs.writeFileSync(path.join(repo, "pkg/.claude/settings.json"), "{}");
  fs.writeFileSync(path.join(repo, "pkg/.claude/settings.local.json"), "{}");
  fs.writeFileSync(path.join(repo, "pkg/keep.ts"), "export {};\n");
  fs.writeFileSync(path.join(repo, "AGENTS.md"), "# rules");
  fs.writeFileSync(path.join(repo, "bug.ts"), "export const x = 1;\n");
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "before fix");
  const oldRef = git(repo, "rev-parse", "HEAD");
  fs.writeFileSync(path.join(repo, "bug.ts"), "export const x = 2; // THE FIX\n");
  git(repo, "commit", "-qam", "fix: the fix");
  const newRef = git(repo, "rev-parse", "HEAD");
  const mirror = `${repo}-mirror.git`;
  tempDirs.push(mirror);
  execFileSync("git", ["clone", "-q", "--mirror", repo, mirror]);
  return { mirror, oldRef, newRef };
}

describe("prepareWorkspace", () => {
  it("exports the tree at ref as a one-commit repo without skills or future history", () => {
    const { mirror, oldRef, newRef } = historyRepo();
    const workspace = tempDir("ws-");
    prepareWorkspace({ mirror, ref: oldRef, workspace });

    expect(fs.readFileSync(path.join(workspace, "bug.ts"), "utf8")).toBe("export const x = 1;\n");
    expect(git(workspace, "rev-list", "--all", "--count")).toBe("1");
    const fixedBlob = execFileSync("git", ["hash-object", "--stdin"], {
      input: "export const x = 2; // THE FIX\n",
      encoding: "utf8",
    }).trim();
    expect(() => git(workspace, "cat-file", "-e", fixedBlob)).toThrow();
    expect(() => git(workspace, "cat-file", "-e", newRef)).toThrow();
    expect(git(workspace, "log", "-1", "--format=%s")).toBe("before fix");
    expect(git(workspace, "status", "--porcelain")).toBe("");
    expect(fs.existsSync(path.join(workspace, ".agents/skills"))).toBe(false);
    expect(fs.existsSync(path.join(workspace, ".claude/skills"))).toBe(false);
    expect(fs.existsSync(path.join(workspace, ".claude/agents"))).toBe(false);
    expect(fs.existsSync(path.join(workspace, ".claude/settings.json"))).toBe(false);
    expect(fs.existsSync(path.join(workspace, "pkg/.claude/skills"))).toBe(false);
    expect(fs.existsSync(path.join(workspace, "pkg/.claude/settings.json"))).toBe(false);
    expect(fs.existsSync(path.join(workspace, "pkg/.claude/settings.local.json"))).toBe(false);
    expect(fs.existsSync(path.join(workspace, "pkg/keep.ts"))).toBe(true);
    expect(fs.existsSync(path.join(workspace, "AGENTS.md"))).toBe(true);
  });

  it("fails loudly on an unknown ref", () => {
    const { mirror } = historyRepo();
    const workspace = tempDir("ws-");
    expect(() => prepareWorkspace({ mirror, ref: "0".repeat(40), workspace })).toThrow();
  });
});
