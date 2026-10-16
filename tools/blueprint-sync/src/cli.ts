// pnpm --filter @storyblok/blueprint-sync stage <blueprint> <target-dir>
// pnpm --filter @storyblok/blueprint-sync verify <blueprint> [dir]
// See ../README.md.
import { type SpawnSyncOptions, spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { join, resolve } from "pathe";

import { loadConfig } from "./config.ts";
import { stage } from "./stage.ts";

const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const TOOL_DIR = fileURLToPath(new URL("../", import.meta.url));

// `pnpm --filter` runs in this package's folder; INIT_CWD is where the user ran pnpm.
const fromUserCwd = (path: string): string => resolve(process.env.INIT_CWD ?? process.cwd(), path);

// What a user's shell has: none of the `npm_*`/`pnpm_*` variables this pnpm script sets, which npm
// would read as config (catalogs, `resolution-mode`, ...).
const userEnv = (): Record<string, string> =>
  Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] =>
        entry[1] !== undefined && !/^(npm|pnpm)_|^INIT_CWD$/i.test(entry[0]),
    ),
  );

// Exits with the command's status: it already printed why it failed.
function run(command: string, args: string[], options: SpawnSyncOptions): void {
  const { status } = spawnSync(command, args, { env: userEnv(), stdio: "inherit", ...options });
  if (status !== 0) {
    process.exit(status ?? 1);
  }
}

async function verify(blueprint: string, projectDir: string): Promise<void> {
  if (!process.env.STORYBLOK_DELIVERY_API_TOKEN) {
    console.warn("STORYBLOK_DELIVERY_API_TOKEN is not set; see tools/blueprint-sync/README.md.");
  }
  const config = await loadConfig(blueprint);
  stage(REPO_ROOT, blueprint, projectDir);
  console.log(`Staged ${blueprint} in ${projectDir}`);

  run("npm", ["install", "--no-audit", "--no-fund"], { cwd: projectDir });
  config.beforeBuild?.(projectDir);
  run(config.build, [], { cwd: projectDir, shell: true });
  run(join(TOOL_DIR, "node_modules/.bin/playwright"), ["test"], {
    cwd: TOOL_DIR,
    env: { ...userEnv(), BLUEPRINT: blueprint, PROJECT_DIR: projectDir },
  });
}

const [command, blueprint, dir] = process.argv.slice(2);
if (command === "stage" && blueprint && dir) {
  stage(REPO_ROOT, blueprint, fromUserCwd(dir));
} else if (command === "verify" && blueprint) {
  await verify(blueprint, dir ? fromUserCwd(dir) : mkdtempSync(join(tmpdir(), `${blueprint}-`)));
} else {
  console.error("Usage: stage <blueprint> <target-dir> | verify <blueprint> [dir]");
  process.exit(2);
}
