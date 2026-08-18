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
  reporter: [["list"]],
  use: {
    baseURL: QA_CONFIG.appBaseUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // The playground serves a self-signed certificate. An untrusted cert fails
    // inside the preview iframe with no visible prompt, which reads as a dead
    // bridge; accepting it here is what makes a locally-trusted cert unnecessary.
    ignoreHTTPSErrors: true,
  },
  projects: [
    { name: "auth", testMatch: /auth\.setup\.ts/ },
    { name: "preflight", testMatch: /preflight\.setup\.ts/ },
    {
      name: "editor",
      testMatch: /.*\.spec\.ts/,
      dependencies: ["auth", "preflight"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: QA_CONFIG.storageStatePath,
        launchOptions: {
          // The editor is served from a public origin and embeds the playground
          // from localhost. Chrome's Local Network Access policy blocks that
          // iframe with net::ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS, and the
          // preview frame silently renders a chrome-error page instead of the
          // app — indistinguishable from a dead bridge unless you look at the
          // frame's URL. Disabling the checks is required for local QA.
          args: [
            "--disable-features=LocalNetworkAccessChecks,BlockInsecurePrivateNetworkRequests,PrivateNetworkAccessSendPreflights",
          ],
        },
      },
    },
  ],
  webServer: {
    command: "pnpm --filter @storyblok/nuxt qa:dev",
    url: QA_CONFIG.previewBaseUrl,
    reuseExistingServer: true,
    timeout: 120_000,
    // Node's TLS stack is separate from Chromium's, so the health check needs
    // its own opt-in to the self-signed cert.
    ignoreHTTPSErrors: true,
  },
});
