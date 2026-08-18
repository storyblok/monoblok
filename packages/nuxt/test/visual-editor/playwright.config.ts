import { defineConfig, devices } from "@playwright/test";
import { QA_CONFIG } from "./config";

export default defineConfig({
  testDir: ".",
  // The specs share one seeded space; a parallel run re-seeds mid-flight and
  // produces failures that look like product defects.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  outputDir: "test-results",
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: QA_CONFIG.appBaseUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "auth", testMatch: /auth\.setup\.ts/ },
    { name: "preflight", testMatch: /preflight\.setup\.ts/, dependencies: ["auth"] },
    {
      name: "editor",
      testMatch: /.*\.spec\.ts/,
      dependencies: ["preflight"],
      use: { ...devices["Desktop Chrome"], storageState: QA_CONFIG.storageStatePath },
    },
  ],
  webServer: {
    command: "pnpm --filter @storyblok/nuxt qa:dev",
    url: QA_CONFIG.previewBaseUrl,
    reuseExistingServer: true,
    timeout: 120_000,
    // The dev server's cert is locally trusted; this only covers the health check.
    ignoreHTTPSErrors: false,
  },
});
