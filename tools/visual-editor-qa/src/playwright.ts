import { defineConfig, devices } from "@playwright/test";
import type { PlaywrightTestConfig } from "@playwright/test";
import type { QaConfig } from "./config";

/**
 * The Playwright config every Visual Editor harness needs. A package passes its
 * `QaConfig` and, if it must, overrides one field.
 */
export const createPlaywrightConfig = (
  config: QaConfig,
  overrides: PlaywrightTestConfig = {},
): PlaywrightTestConfig =>
  defineConfig({
    testDir: ".",
    // The specs share one seeded space; a parallel run re-seeds mid-flight and
    // produces failures that look like product defects.
    workers: 1,
    fullyParallel: false,
    retries: 0,
    outputDir: "test-results",
    reporter: [["list"]],
    use: {
      baseURL: config.appBaseUrl,
      trace: "retain-on-failure",
      screenshot: "only-on-failure",
      // The playground serves a self-signed certificate. An untrusted cert fails
      // inside the preview iframe with no visible prompt, which reads as a dead
      // bridge; accepting it here is what makes a trusted cert unnecessary.
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
          storageState: config.storageStatePath,
          launchOptions: {
            // The editor is served from a public origin and embeds the playground
            // from localhost. Chrome's Local Network Access policy blocks that
            // iframe with net::ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS and the
            // preview frame renders a chrome-error page instead of the app,
            // indistinguishable from a dead bridge unless you read the frame's URL.
            args: [
              "--disable-features=LocalNetworkAccessChecks,BlockInsecurePrivateNetworkRequests,PrivateNetworkAccessSendPreflights",
            ],
          },
        },
      },
    ],
    webServer: {
      command: `pnpm --filter ${config.packageName} qa:dev`,
      // The seeded story, not the origin: a dev server that boots but serves the
      // wrong space still answers on `/`.
      url: `${config.previewBaseUrl}${config.previewPath}`,
      reuseExistingServer: true,
      timeout: 120_000,
      // Node's TLS stack is separate from Chromium's, so the health check needs
      // its own opt-in to the self-signed cert.
      ignoreHTTPSErrors: true,
    },
    ...overrides,
  });
