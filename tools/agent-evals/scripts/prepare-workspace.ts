import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { EVALS_DIR } from "../src/arms.ts";
import { recordBaseline } from "../src/baseline.ts";
import { bugCase } from "../src/cases.ts";
import { cloneCachedDirectory } from "../src/workspace-cache.ts";

/** Repo-relative paths, at any depth, that would hand the agent our skills or settings regardless of arm. */
const STRIPPED_SUFFIXES = [
  ".agents/skills",
  ".claude/skills",
  ".claude/agents",
  ".claude/settings.json",
  ".claude/settings.local.json",
];
const STRIPPED_ROOT_PATHS = ["claude-output"];

function stripLeaks(dir: string, relative = ""): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = relative ? `${relative}/${entry.name}` : entry.name;
    const full = path.join(dir, entry.name);
    if (STRIPPED_SUFFIXES.some((suffix) => rel === suffix || rel.endsWith(`/${suffix}`))) {
      fs.rmSync(full, { recursive: true, force: true });
    } else if (entry.isDirectory()) {
      stripLeaks(full, rel);
    }
  }
}

export type PrepareWorkspaceOptions = {
  mirror: string;
  ref: string;
  workspace: string;
  /** Commit message of the exported snapshot; defaults to the message of `ref`. */
  message?: string;
  install?: { packageName: string };
};

const git = (cwd: string, args: string[]): string =>
  execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

const INSTALL_LOG_TAIL_LINES = 40;

// The install and build path needs a real pnpm install; `run.sh` exercises it, not unit tests.
// pnpm reads the shared store from `npm_config_store_dir`, which `run.sh` exports.
function installDependencies(workspace: string, packageName: string): void {
  const args = [
    "install",
    "--frozen-lockfile",
    "--prefer-offline",
    "--reporter=append-only",
    "--filter",
    `${packageName}...`,
  ];
  const logPath = path.join(workspace, ".agent-evals", "install.log");
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  let output = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    const result = spawnSync("pnpm", args, {
      cwd: workspace,
      encoding: "utf8",
      env: { ...process.env, CI: "1" },
    });
    output += `--- attempt ${attempt} (exit ${result.status}) ---\n${result.stdout}${result.stderr}\n`;
    fs.writeFileSync(logPath, output);
    if (result.status === 0) return;
  }
  const tail = output.trimEnd().split("\n").slice(-INSTALL_LOG_TAIL_LINES).join("\n");
  throw new Error(`pnpm install failed twice in ${workspace}. Last log lines:\n${tail}`);
}

export function prepareWorkspace({
  mirror,
  ref,
  workspace,
  message = git(mirror, ["log", "-1", "--format=%B", ref]),
  install,
}: PrepareWorkspaceOptions): void {
  const archiveDir = fs.mkdtempSync(path.join(os.tmpdir(), "archive-"));
  try {
    const archive = path.join(archiveDir, "tree.tar");
    execFileSync("git", ["-C", mirror, "archive", "-o", archive, ref]);
    execFileSync("tar", ["-xf", archive, "-C", workspace]);
  } finally {
    fs.rmSync(archiveDir, { recursive: true, force: true });
  }
  stripLeaks(workspace);
  for (const p of STRIPPED_ROOT_PATHS)
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

  recordBaseline(workspace);

  if (install) {
    installDependencies(workspace, install.packageName);
    const dependencies = `${install.packageName}^...`;
    const buildEnv = { ...process.env, NX_DAEMON: "false", NX_NO_CLOUD: "true" };
    const run = (script: string[]): void => {
      execFileSync("pnpm", ["--filter", dependencies, ...script], {
        cwd: workspace,
        stdio: "inherit",
        env: buildEnv,
      });
    };
    // Older refs do not commit generated sources. Generation needs the built OpenAPI
    // package, so build once without bailing, generate, then build for real.
    try {
      run(["--no-bail", "run", "--if-present", "build"]);
    } catch {
      // Expected when generated sources are missing; the final build reports real failures.
    }
    run(["run", "--if-present", "generate"]);
    run(["run", "build"]);
  }
}

if (import.meta.main) {
  const { values } = parseArgs({
    options: {
      ref: { type: "string" },
      case: { type: "string" },
      message: { type: "string" },
      "no-install": { type: "boolean" },
    },
  });
  const ref = values.ref;
  if (!ref) throw new Error("--ref is required");
  const c = values.case ? bugCase(values.case) : undefined;
  const install = c && !values["no-install"] ? { packageName: c.packageName } : undefined;
  // Every arm and run of a case starts from the same workspace, so it is installed and built
  // once and cloned per job. The key includes this script, so edits to it rebuild the cache.
  const key = createHash("sha256")
    .update(JSON.stringify({ ref, message: values.message, install }))
    .update(fs.readFileSync(import.meta.filename))
    .digest("hex")
    .slice(0, 16);
  cloneCachedDirectory({
    cacheRoot: path.join(EVALS_DIR, ".cache", "workspaces"),
    key,
    target: process.cwd(),
    build: (workspace) =>
      prepareWorkspace({
        mirror: path.join(EVALS_DIR, ".cache", "monoblok.git"),
        ref,
        workspace,
        message: values.message,
        install,
      }),
  });
}
