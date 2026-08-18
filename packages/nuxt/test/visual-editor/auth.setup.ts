import { existsSync } from "node:fs";
import { expect, test as setup } from "@playwright/test";
import { QA_CONFIG } from "./config";

const REGENERATE = "pnpm --filter @storyblok/nuxt qa:auth";

setup("a valid app session exists", async ({ page }) => {
  expect(
    existsSync(QA_CONFIG.storageStatePath),
    `No saved session at ${QA_CONFIG.storageStatePath}. Create one with: ${REGENERATE}`,
  ).toBe(true);

  // A saved-but-expired session redirects to the login screen. Assert we
  // reached the app, not that no error was thrown.
  await page.goto(`${QA_CONFIG.appBaseUrl}/#/me/spaces/${QA_CONFIG.spaceId}/stories`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page, `Session expired. Refresh it with: ${REGENERATE}`).not.toHaveURL(/#!?\/login/);
});
