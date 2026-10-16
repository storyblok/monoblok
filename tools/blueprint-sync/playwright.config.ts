import { defineConfig } from "@playwright/test";

import { loadConfig } from "./src/config.ts";

// Set by `verify` (src/cli.ts).
const { BLUEPRINT = "", PROJECT_DIR = "" } = process.env;
const config = await loadConfig(BLUEPRINT);
const timeout = Number(process.env.SMOKE_TIMEOUT_MS ?? 15_000);

export default defineConfig({
  testDir: "src",
  testMatch: "smoke.ts",
  // Failure traces next to the staged project, not in the repo.
  outputDir: `${PROJECT_DIR}/.smoke-results`,
  // One budget for the whole check, not one per expected text.
  timeout,
  expect: { timeout },
  retries: 0,
  reporter: "list",
  use: {
    baseURL: config.url,
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
