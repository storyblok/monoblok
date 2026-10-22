// pnpm --filter @storyblok/blueprint-sync stage <blueprint> <target-dir>
// pnpm --filter @storyblok/blueprint-sync verify <blueprint> [dir]
// pnpm --filter @storyblok/blueprint-sync verify <blueprint> --from <staged-dir>
// pnpm --filter @storyblok/blueprint-sync check <blueprint>
// See ../README.md.
import { type SpawnSyncOptions, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { join, resolve } from "pathe";

import { loadConfig } from "./config.ts";
import { userEnv, withoutBlueprintEnv } from "./env.ts";
import { snapshot } from "./snapshot.ts";
import { stage } from "./stage.ts";

const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const TOOL_DIR = fileURLToPath(new URL("../", import.meta.url));

// `pnpm --filter` runs in this package's folder; INIT_CWD is where the user ran pnpm.
const fromUserCwd = (path: string): string => resolve(process.env.INIT_CWD ?? process.cwd(), path);

// What a user installing the package gets. Throws when the package has no `latest` on npm, so a
// sync fails closed when a release was merged but not published.
function npmLatest(name: string): string {
  const { stdout, status, stderr, error } = spawnSync("npm", ["view", name, "dist-tags.latest"], {
    env: userEnv(),
    encoding: "utf8",
  });
  const version = stdout?.trim();
  if (error) {
    throw new Error(`Could not run npm to look up ${name}: ${error.message}`);
  }
  if (status !== 0 || !version) {
    throw new Error(`${name} has no "latest" on npm: ${stderr?.trim() || "npm view failed"}`);
  }
  return version;
}

// Exits with the command's status: it already printed why it failed.
function run(command: string, args: string[], options: SpawnSyncOptions): void {
  const { status, error } = spawnSync(command, args, {
    env: userEnv(),
    stdio: "inherit",
    ...options,
  });
  if (error) {
    // The command did not start (not on `PATH`, ...), so it printed nothing.
    console.error(`Could not run ${command}: ${error.message}`);
  }
  if (status !== 0) {
    process.exit(status ?? 1);
  }
}

// Before anything is loaded or created, so a typo is a message and not a stack trace.
function requireBlueprint(blueprint: string): void {
  if (!existsSync(join(REPO_ROOT, "blueprints", blueprint, "package.json"))) {
    console.error(`Unknown blueprint "${blueprint}": no blueprints/${blueprint}/package.json`);
    process.exit(2);
  }
}

// Without it every server answers with errors and the check ends in a timeout a minute later.
function requireToken(): string {
  const token = process.env.STORYBLOK_DELIVERY_API_TOKEN;
  if (!token) {
    console.error("STORYBLOK_DELIVERY_API_TOKEN is not set; see tools/blueprint-sync/README.md.");
    process.exit(2);
  }
  return token;
}

// npm 10 crashes resolving some blueprints without a lockfile (Arborist `edgesOut`), so the staged
// tree ships a lockfile that npm 11 resolved. It is generated from the staged manifest, where
// `workspace:^` is already `^<version>`. `--ignore-scripts` keeps blueprint code from running.
// `--allow-remote=all` is npm 11's behavior: npm 12 refuses the registry tarball it must read to
// resolve a package with bundled dependencies (`@parcel/watcher-wasm`, via nuxt).
function lock(projectDir: string): void {
  const { stdout } = spawnSync("npm", ["--version"], { env: userEnv(), encoding: "utf8" });
  const major = Number.parseInt(stdout ?? "", 10);
  if (!(major >= 11)) {
    console.error(
      `npm 11 or newer is required to write the lockfile, found ${stdout?.trim() || "none"}.`,
    );
    process.exit(1);
  }
  run(
    "npm",
    [
      "install",
      "--package-lock-only",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--allow-remote=all",
    ],
    {
      cwd: projectDir,
    },
  );
}

// `fromDir` is a tree `stage` already wrote (the sync's `stage` job uploads it): it is installed,
// built, and checked as is, so the lockfile tested is the lockfile that ships. Without it, the
// blueprint is staged and locked into `projectDir` first.
async function verify(blueprint: string, dir?: string, fromDir?: string): Promise<void> {
  requireBlueprint(blueprint);
  if (fromDir) {
    if (
      !existsSync(join(fromDir, "package.json")) ||
      !existsSync(join(fromDir, "package-lock.json"))
    ) {
      console.error(
        `${fromDir} is not a staged blueprint: package.json or package-lock.json is missing.`,
      );
      process.exit(2);
    }
  }
  const token = requireToken();
  const config = await loadConfig(blueprint);
  const projectDir = fromDir ?? dir ?? mkdtempSync(join(tmpdir(), `${blueprint}-`));
  if (!fromDir) {
    stage(REPO_ROOT, blueprint, projectDir, undefined, npmLatest);
    lock(projectDir);
    console.log(`Staged ${blueprint} in ${projectDir}`);
  }

  run("npm", ["ci", "--no-audit", "--no-fund"], { cwd: projectDir });
  // As `storyblok create` hands the project over: a `.env` with the token and region, and nothing
  // in the process env. Angular has no `.env`; its config writes the environment files instead.
  const usesEnvFile = existsSync(join(projectDir, ".env.example"));
  if (usesEnvFile) {
    writeFileSync(
      join(projectDir, ".env"),
      `# Storyblok Configuration\nSTORYBLOK_DELIVERY_API_TOKEN=${token}\nSTORYBLOK_REGION=eu\n`,
    );
  }
  config.beforeBuild?.(projectDir);
  const env = usesEnvFile ? withoutBlueprintEnv(userEnv()) : userEnv();
  run(config.build, [], { cwd: projectDir, shell: true, env });
  smoke(blueprint, projectDir, {}, env);
}

function smoke(
  blueprint: string,
  projectDir: string,
  extra: Record<string, string> = {},
  env: Record<string, string> = userEnv(),
): void {
  run(join(TOOL_DIR, "node_modules/.bin/playwright"), ["test"], {
    cwd: TOOL_DIR,
    env: { ...env, BLUEPRINT: blueprint, PROJECT_DIR: projectDir, ...extra },
  });
}

// The nx `smoke` target (ADR-0022): builds `blueprints/<blueprint>` in the workspace, where
// `workspace:^` links the SDK source nx has just built, and checks it. No stage, no install, no
// lockfile: `verify` owns what users get. The build runs here and not in the nx `build` target
// because the demo token is baked into it. Build output lands in the blueprint folder, which its
// `.gitignore` covers; what `beforeBuild` rewrites is put back, even on failure.
async function check(blueprint: string): Promise<void> {
  requireBlueprint(blueprint);
  requireToken();
  const projectDir = join(REPO_ROOT, "blueprints", blueprint);
  const config = await loadConfig(blueprint);
  // `run` exits the process on failure, which skips `finally`; `exit` handlers still run.
  const restore = snapshot(projectDir, config.writes ?? []);
  process.on("exit", restore);
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => process.exit(1));
  }

  config.beforeBuild?.(projectDir);
  run(config.build, [], { cwd: projectDir, shell: true });
  // A set SMOKE_RESULTS_DIR (CI uploads it) gets one folder per blueprint: Playwright empties its
  // output directory, and several blueprints are checked in one run.
  const resultsDir = process.env.SMOKE_RESULTS_DIR;
  smoke(blueprint, projectDir, {
    SMOKE_RESULTS_DIR: resultsDir
      ? join(resultsDir, blueprint)
      : mkdtempSync(join(tmpdir(), `${blueprint}-smoke-`)),
  });
}

const USAGE =
  "Usage: stage <blueprint> <target-dir> | verify <blueprint> [dir] | verify <blueprint> --from <staged-dir> | check <blueprint>";

const {
  values: { from, help },
  positionals: [command, blueprint, dir],
} = parseArgs({
  args: process.argv.slice(2),
  options: { from: { type: "string" }, help: { type: "boolean", short: "h" } },
  allowPositionals: true,
});
if (help) {
  console.log(USAGE);
} else if (command === "stage" && blueprint && dir && !from) {
  requireBlueprint(blueprint);
  const projectDir = fromUserCwd(dir);
  stage(REPO_ROOT, blueprint, projectDir, undefined, npmLatest);
  lock(projectDir);
} else if (command === "verify" && blueprint && !(from && dir)) {
  await verify(blueprint, dir ? fromUserCwd(dir) : undefined, from ? fromUserCwd(from) : undefined);
} else if (command === "check" && blueprint && !from) {
  await check(blueprint);
} else {
  console.error(USAGE);
  process.exit(2);
}
