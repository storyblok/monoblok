import { execFileSync } from "node:child_process";
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "pathe";

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
  const output = execFileSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--deduplicate"],
    { cwd: source, encoding: "utf8" },
  );
  // `--cached` still lists files deleted from the working tree but not yet from the index.
  return output.split("\0").filter((file) => file !== "" && existsSync(join(source, file)));
}

/**
 * Makes `targetDir` exactly what the target repo gets: a mirror of `blueprints/<blueprint>/`,
 * dotfiles included, plus `package.json` with `workspace:^` resolved and the composed `AGENTS.md`.
 * A `.git` in `targetDir` is kept.
 */
export function stage(
  repoRoot: string,
  blueprint: string,
  targetDir: string,
  workspace: WorkspacePackage[] = listWorkspacePackages(repoRoot),
): void {
  const source = join(repoRoot, "blueprints", blueprint);
  if (!existsSync(join(source, "package.json"))) {
    throw new Error(`Unknown blueprint "${blueprint}": no blueprints/${blueprint}/package.json`);
  }

  const packageJson = resolveWorkspaceDependencies(
    readFileSync(join(source, "package.json"), "utf8"),
    workspace,
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

  if (existsSync(targetDir)) {
    for (const entry of readdirSync(targetDir)) {
      if (entry !== ".git") {
        rmSync(join(targetDir, entry), { recursive: true, force: true });
      }
    }
  }
  for (const file of blueprintFiles(source)) {
    cpSync(join(source, file), join(targetDir, file));
  }
  writeFileSync(join(targetDir, "package.json"), packageJson);
  writeFileSync(join(targetDir, "AGENTS.md"), agentsMd);
}
