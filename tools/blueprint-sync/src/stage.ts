import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "pathe";

import {
  listWorkspacePackages,
  resolveWorkspaceDependencies,
  type WorkspacePackage,
} from "./resolve.ts";

/** `AGENTS.md` in the target: the blueprint's framework part, then the shared Storyblok part. */
export function composeAgents(frameworkPart: string, storyblokPart: string): string {
  return `${frameworkPart.trimEnd()}\n\n## Storyblok\n\n<!-- synced from storyblok/monoblok; edit in the monorepo -->\n\n${storyblokPart.trimEnd()}\n`;
}

/** npm scripts that `agentsMd` tells an agent to run but `packageJson` does not define. */
export function missingScripts(agentsMd: string, packageJson: string): string[] {
  const scripts = new Set(Object.keys(JSON.parse(packageJson).scripts ?? {}));
  const mentioned = new Set([
    ...[...agentsMd.matchAll(/npm run ([\w:-]+)/g)].map((match) => match[1]),
    ...[...agentsMd.matchAll(/npm (start|test)\b/g)].map((match) => match[1]),
  ]);
  return [...mentioned].filter((script) => !scripts.has(script)).toSorted();
}

/**
 * The blueprint's files as a commit would see them: tracked, plus new files its `.gitignore` does
 * not ignore. A local `.env`, `node_modules`, or build output never reaches a target.
 */
function blueprintFiles(source: string): string[] {
  // A tracked file that an ignore file matches would be verified here, and `git add -A` in the
  // target would skip it. The monorepo's root `.gitignore` counts too: a file it ignores must be
  // force-added here, and the target would not know to.
  const ignored = execFileSync(
    "git",
    ["ls-files", "-z", "--cached", "--ignored", "--exclude-standard"],
    {
      cwd: source,
      encoding: "utf8",
    },
  )
    .split("\0")
    .filter((file) => file !== "" && file !== "project.json" && existsSync(join(source, file)));
  if (ignored.length > 0) {
    throw new Error(
      `Tracked files that a .gitignore ignores would not reach the target: ${ignored.join(", ")}`,
    );
  }
  const output = execFileSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--deduplicate"],
    { cwd: source, encoding: "utf8" },
  );
  // `--cached` still lists files deleted from the working tree but not yet from the index.
  // `project.json` is nx config for the workspace (ADR-0022), not part of the template.
  const files = output
    .split("\0")
    .filter((file) => file !== "" && file !== "project.json" && existsSync(join(source, file)));
  // The targets have no CI of their own (ADR-0022), and the App cannot push workflow files.
  const github = files.filter((file) => file === ".github" || file.startsWith(".github/"));
  if (github.length > 0) {
    throw new Error(
      `A blueprint must not ship .github, the targets have none: ${github.join(", ")}`,
    );
  }
  return files;
}

/** The real path of `path`, which may not exist yet: its nearest existing ancestor, resolved. */
function realPathOf(path: string): string {
  const absolute = resolve(path);
  let existing = absolute;
  const rest: string[] = [];
  while (!existsSync(existing)) {
    rest.unshift(basename(existing));
    existing = dirname(existing);
  }
  return join(realpathSync.native(existing), ...rest);
}

/**
 * `stage` writes into a directory that is empty or not there yet. A checkout of a template repo is
 * not accepted: nothing needs it, and an accepted `.git` would make a sibling project, or this
 * repository reached through a symlink or another spelling of its path, a valid target. Paths are
 * compared as real paths for that reason.
 */
function assertWritable(repoRoot: string, targetDir: string): void {
  const fromRoot = relative(realPathOf(repoRoot), realPathOf(targetDir));
  if (fromRoot !== ".." && !fromRoot.startsWith("../") && !isAbsolute(fromRoot)) {
    throw new Error(`Refusing to stage into ${targetDir}: it is inside the repository.`);
  }
  if (existsSync(targetDir) && readdirSync(targetDir).length > 0) {
    throw new Error(`Refusing to stage into ${targetDir}: it is not empty.`);
  }
}

/**
 * Makes `targetDir` exactly what the target repo gets: a mirror of `blueprints/<blueprint>/`,
 * dotfiles included (but not the workspace's nx `project.json`), plus `package.json` with
 * `workspace:^` resolved (to npm's `latest` when `latestVersion` is given) and the composed
 * `AGENTS.md`. `targetDir` must be empty or missing, and nothing is written when a check fails.
 */
export function stage(
  repoRoot: string,
  blueprint: string,
  targetDir: string,
  workspace: WorkspacePackage[] = listWorkspacePackages(repoRoot),
  latestVersion?: (name: string) => string,
): void {
  const source = join(repoRoot, "blueprints", blueprint);
  if (!existsSync(join(source, "package.json"))) {
    throw new Error(`Unknown blueprint "${blueprint}": no blueprints/${blueprint}/package.json`);
  }

  const packageJson = resolveWorkspaceDependencies(
    readFileSync(join(source, "package.json"), "utf8"),
    workspace,
    latestVersion,
  );
  const agentsMd = composeAgents(
    readFileSync(join(source, "AGENTS.md"), "utf8"),
    readFileSync(join(repoRoot, "blueprints", "AGENTS.storyblok.md"), "utf8"),
  );
  if (packageJson.includes('"workspace:')) {
    throw new Error(`Unresolved "workspace:" left in blueprints/${blueprint}/package.json`);
  }
  const missing = missingScripts(agentsMd, packageJson);
  if (missing.length > 0) {
    throw new Error(`AGENTS.md mentions npm scripts package.json lacks: ${missing.join(", ")}`);
  }

  // Every check before the first write, so a failure leaves nothing behind.
  const files = blueprintFiles(source);
  assertWritable(repoRoot, targetDir);
  for (const file of files) {
    cpSync(join(source, file), join(targetDir, file));
  }
  mkdirSync(targetDir, { recursive: true });
  writeFileSync(join(targetDir, "package.json"), packageJson);
  writeFileSync(join(targetDir, "AGENTS.md"), agentsMd);
}
