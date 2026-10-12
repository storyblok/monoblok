import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

/**
 * `<StoryblokPreview />`'s prerendered-route warning runs in the Astro
 * component's frontmatter, so it's logged by the dev server's own process,
 * not the browser the rest of this suite drives. This spec owns its own
 * dev server (rather than reusing the shared one on :4321) so it can
 * capture that output, pointed at `playground/prerender-warning`: a
 * dedicated project root, since Astro refuses to run two `astro dev`
 * instances against the same one.
 */
const PORT = 4325;
const BASE_URL = `http://localhost:${PORT}`;
const WARNING_TEXT = "is rendered on a prerendered route";
const PLAYGROUND_DIR = fileURLToPath(new URL("../playground/prerender-warning", import.meta.url));
// Resolved from the playground's own `astro`, via `node bin/astro.mjs`
// rather than the `.bin` shim: identical on every OS, no shell needed.
const astroPackageJsonPath = createRequire(`${PLAYGROUND_DIR}/`).resolve("astro/package.json");
const ASTRO_CLI = fileURLToPath(new URL("./bin/astro.mjs", `file://${astroPackageJsonPath}`));

let server: ChildProcessWithoutNullStreams;
let output = "";

test.describe("<StoryblokPreview /> prerendered-route warning", () => {
  test.beforeAll(async () => {
    // `detached: true` puts the process in its own group so `afterAll` can
    // kill the whole tree, including the Vite dev server `astro` spawns.
    server = spawn(process.execPath, [ASTRO_CLI, "dev", "--port", String(PORT)], {
      cwd: PLAYGROUND_DIR,
      env: { ...process.env, ASTRO_DEV_BACKGROUND: "1", STORYBLOK_E2E: "1" },
      detached: true,
    });
    server.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    server.stderr.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });

    await waitForServer(BASE_URL);
  });

  test.afterAll(() => {
    if (!server.pid) {
      return;
    }
    // `detached: true` only grants a killable process group on POSIX;
    // Windows needs `taskkill /T` to walk the same tree instead.
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(server.pid), "/T", "/F"]);
    } else {
      process.kill(-server.pid, "SIGTERM");
    }
  });

  test("warns on a prerendered route", async ({ request }) => {
    output = "";
    const response = await request.get(`${BASE_URL}/prerendered-preview`);
    expect(response.ok()).toBe(true);

    await expect.poll(() => output).toContain(WARNING_TEXT);
  });

  test("stays silent on an on-demand route", async ({ request }) => {
    output = "";
    const response = await request.get(`${BASE_URL}/on-demand-preview`);
    expect(response.ok()).toBe(true);

    // No success signal to poll for here, so give the frontmatter a moment
    // to run before asserting its absence.
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(output).not.toContain(WARNING_TEXT);
  });
});

async function waitForServer(url: string, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      // Any response means the server is accepting connections; there's no
      // `/` route in this fixture, so a 404 still counts as "up".
      await fetch(url);
      return;
    } catch {
      // Not accepting connections yet; retry until the deadline.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Server at ${url} did not start within ${timeoutMs}ms`);
}
