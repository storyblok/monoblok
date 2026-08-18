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
    // The playground serves a mkcert certificate. An untrusted cert fails inside
    // the preview iframe with no visible prompt, which reads as a dead bridge.
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
          // iframe with net::ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS and the
          // preview frame renders a chrome-error page instead of the app —
          // indistinguishable from a dead bridge unless you read the frame's URL.
          args: [
            "--disable-features=LocalNetworkAccessChecks,BlockInsecurePrivateNetworkRequests,PrivateNetworkAccessSendPreflights",
          ],
        },
      },
    },
  ],
  webServer: {
    // `astro dev` daemonizes when stdout is not a TTY, so the start command
    // exits immediately and Playwright would call that an early exit. `qa:dev`
    // starts the daemon and then follows its logs, which is the long-running
    // process Playwright waits on. Teardown kills the log tail, not the server;
    // `reuseExistingServer` picks it up next run, and `qa:stop` ends it.
    command: "pnpm --filter @storyblok/astro qa:dev",
    url: `${QA_CONFIG.previewBaseUrl}/home`,
    reuseExistingServer: true,
    timeout: 120_000,
    // Node's TLS stack is separate from Chromium's, so the health check needs
    // its own opt-in to the self-signed cert.
    ignoreHTTPSErrors: true,
  },
});
