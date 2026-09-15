import { defineConfig, devices } from "@playwright/test";
import { QA_CONFIG } from "./qa.config";

export default defineConfig({
  testDir: ".",
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: QA_CONFIG.appBaseUrl,
    storageState: QA_CONFIG.storageStatePath,
    ignoreHTTPSErrors: true,
    launchOptions: {
      args: [
        "--disable-features=LocalNetworkAccessChecks,BlockInsecurePrivateNetworkRequests,PrivateNetworkAccessSendPreflights",
      ],
    },
  },
  webServer: {
    command: "pnpm run qa:dev",
    url: `${QA_CONFIG.previewBaseUrl}${QA_CONFIG.previewPath}`,
    reuseExistingServer: true,
    timeout: 120_000,
    ignoreHTTPSErrors: true,
  },
});
