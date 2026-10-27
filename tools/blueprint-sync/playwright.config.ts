import { defineConfig } from "@playwright/test";

import { loadConfig } from "./src/config.ts";

// Set by `verify` and `smoke` (src/cli.ts).
const { BLUEPRINT = "", PROJECT_DIR = "" } = process.env;
const config = await loadConfig(BLUEPRINT);
const timeout = Number(process.env.SMOKE_TIMEOUT_MS ?? 15_000);

export default defineConfig({
  testDir: "src",
  testMatch: "smoke.ts",
  // Failure traces next to the staged project, not in the repo. `smoke` sets a temp folder: the
  // project is a blueprint folder, and what lands there ships on the next sync.
  outputDir: process.env.SMOKE_RESULTS_DIR ?? `${PROJECT_DIR}/.smoke-results`,
  // One budget for the whole smoke test, not one per expected text.
  timeout,
  expect: { timeout },
  // The smoke test runs against a live demo space and a CDN. One retry in CI keeps a flaky leg from
  // blocking every push of a sync (a red `verify` leg stops them all).
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: config.url,
    trace: "retain-on-failure",
    // The Chrome preinstalled on GitHub's ubuntu runners: no browser download.
    channel: "chrome",
    ignoreHTTPSErrors: true,
  },
  webServer: {
    command: config.start,
    cwd: PROJECT_DIR,
    url: config.url,
    ignoreHTTPSErrors: true,
    // Fails on a busy port instead of testing whatever an earlier run left there.
    reuseExistingServer: false,
    timeout: 60_000,
    stdout: "pipe",
  },
});
