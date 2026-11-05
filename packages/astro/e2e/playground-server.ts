import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

/** `playground/test`, the project the shared e2e dev server runs. */
export const PLAYGROUND_DIR = fileURLToPath(new URL("../playground/test", import.meta.url));

// Resolved from the playground's own `astro`, via `node bin/astro.mjs`
// rather than the `.bin` shim: identical on every OS, no shell needed.
const astroPackageJsonPath = createRequire(`${PLAYGROUND_DIR}/`).resolve("astro/package.json");
const ASTRO_CLI = fileURLToPath(new URL("./bin/astro.mjs", `file://${astroPackageJsonPath}`));

export type AstroProcess = {
  process: ChildProcessWithoutNullStreams;
  /** Everything the process wrote to stdout and stderr so far. */
  output: () => string;
  /** Clears what `output()` returns. */
  clearOutput: () => void;
};

/**
 * Runs the Astro CLI in `playground/test`. `detached: true` puts the process
 * in its own group so `stopAstro` can kill the whole tree, including the Vite
 * server `astro` spawns.
 */
export function runAstro(args: string[]): AstroProcess {
  const child = spawn(process.execPath, [ASTRO_CLI, ...args], {
    cwd: PLAYGROUND_DIR,
    env: { ...process.env, ASTRO_DEV_BACKGROUND: "1", STORYBLOK_E2E: "1" },
    detached: true,
  });
  let output = "";
  child.stdout.on("data", (chunk: Buffer) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk: Buffer) => {
    output += chunk.toString();
  });
  return {
    process: child,
    output: () => output,
    clearOutput: () => {
      output = "";
    },
  };
}

/** Resolves when `astro` exits with code 0, rejects with its output otherwise. */
export function waitForExit(astro: AstroProcess): Promise<void> {
  return new Promise((resolve, reject) => {
    astro.process.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`astro exited with code ${code}:\n${astro.output()}`));
      }
    });
  });
}

export function stopAstro(astro: AstroProcess | undefined): void {
  const pid = astro?.process.pid;
  if (!pid || astro.process.exitCode !== null) {
    return;
  }
  // `detached: true` only grants a killable process group on POSIX;
  // Windows needs `taskkill /T` to walk the same tree instead.
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(pid), "/T", "/F"]);
  } else {
    process.kill(-pid, "SIGTERM");
  }
}

export async function waitForServer(url: string, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      // Any response means the server is accepting connections.
      await fetch(url);
      return;
    } catch {
      // Not accepting connections yet; retry until the deadline.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Server at ${url} did not start within ${timeoutMs}ms`);
}
