import { execFileSync, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { EVALS_DIR } from "../src/arms.ts";
import { bugCase } from "../src/cases.ts";

/** Paths that would hand the agent our skills regardless of arm. */
const STRIPPED_PATHS = [".agents/skills", ".claude/skills", ".claude/agents", "claude-output"];

export type PrepareWorkspaceOptions = {
  mirror: string;
  ref: string;
  workspace: string;
  install?: { packageName: string; storeDir?: string };
};

const git = (cwd: string, args: string[]): string =>
  execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

export function prepareWorkspace({
  mirror,
  ref,
  workspace,
  install,
}: PrepareWorkspaceOptions): void {
  const message = git(mirror, ["log", "-1", "--format=%B", ref]);
  execSync(`git -C "${mirror}" archive ${ref} | tar -x -C "${workspace}"`, { stdio: "inherit" });
  for (const p of STRIPPED_PATHS)
    fs.rmSync(path.join(workspace, p), { recursive: true, force: true });

  git(workspace, ["init", "-q", "-b", "main"]);
  git(workspace, ["add", "-A"]);
  git(workspace, [
    "-c",
    "user.name=eval",
    "-c",
    "user.email=eval@example.com",
    "commit",
    "-q",
    "-m",
    message,
  ]);

  if (install) {
    const store = install.storeDir ? ["--store-dir", install.storeDir] : [];
    execFileSync(
      "pnpm",
      [
        "install",
        "--frozen-lockfile",
        "--prefer-offline",
        "--filter",
        `${install.packageName}...`,
        ...store,
      ],
      { cwd: workspace, stdio: "inherit", env: { ...process.env, CI: "1" } },
    );
    execFileSync("pnpm", ["--filter", `${install.packageName}^...`, "run", "build"], {
      cwd: workspace,
      stdio: "inherit",
      env: { ...process.env, NX_DAEMON: "false", NX_NO_CLOUD: "true" },
    });
  }
}

if (import.meta.main) {
  const { values } = parseArgs({
    options: {
      ref: { type: "string" },
      case: { type: "string" },
      "no-install": { type: "boolean" },
    },
  });
  const ref = values.ref;
  if (!ref) throw new Error("--ref is required");
  const c = values.case ? bugCase(values.case) : undefined;
  prepareWorkspace({
    mirror: path.join(EVALS_DIR, ".cache", "monoblok.git"),
    ref,
    workspace: process.cwd(),
    install:
      c && !values["no-install"]
        ? { packageName: c.packageName, storeDir: process.env.AGENT_EVALS_PNPM_STORE }
        : undefined,
  });
}
