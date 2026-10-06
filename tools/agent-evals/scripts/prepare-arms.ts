import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  ARM_NAMES,
  EVALS_DIR,
  REPO_ROOT,
  SUPERPOWERS_DIR,
  SUPERPOWERS_REF,
  SUPERPOWERS_REPO,
  armDir,
  armHasMonoblok,
} from "../src/arms.ts";
import { stripRoutingFrontmatter } from "../src/frontmatter.ts";

type PrepareArmsOptions = { sourceRoot?: string; outRoot?: string; skipSuperpowers?: boolean };

function copySkills(from: string, to: string): void {
  fs.cpSync(from, to, {
    recursive: true,
    filter: (src) => !src.includes(`${path.sep}node_modules`),
  });
  for (const entry of fs.readdirSync(to, { recursive: true, withFileTypes: true })) {
    if (entry.isFile() && entry.name === "SKILL.md") {
      const file = path.join(entry.parentPath, entry.name);
      fs.writeFileSync(file, stripRoutingFrontmatter(fs.readFileSync(file, "utf8")));
    }
  }
}

function ensureSuperpowers(): void {
  if (fs.existsSync(path.join(SUPERPOWERS_DIR, ".claude-plugin", "plugin.json"))) return;
  fs.rmSync(SUPERPOWERS_DIR, { recursive: true, force: true });
  execFileSync("git", [
    "clone",
    "--quiet",
    "--depth",
    "1",
    "--branch",
    SUPERPOWERS_REF,
    SUPERPOWERS_REPO,
    SUPERPOWERS_DIR,
  ]);
}

export async function prepareArms(options: PrepareArmsOptions = {}): Promise<void> {
  const sourceRoot = options.sourceRoot ?? REPO_ROOT;
  const outRoot = options.outRoot ?? EVALS_DIR;
  for (const arm of ARM_NAMES) {
    const dir = armDir(arm, outRoot);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    if (!armHasMonoblok(arm)) continue;
    copySkills(path.join(sourceRoot, ".agents/skills"), path.join(dir, "skills"));
    fs.cpSync(path.join(sourceRoot, ".claude/agents"), path.join(dir, "agents"), {
      recursive: true,
    });
  }
  if (!options.skipSuperpowers) ensureSuperpowers();
}

if (import.meta.main) await prepareArms();
