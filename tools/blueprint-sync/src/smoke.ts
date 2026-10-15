// Playwright spec, run by `verify` through ../playwright.config.ts.
import { expect, test } from "@playwright/test";

import { loadConfig } from "./config.ts";

const blueprint = process.env.BLUEPRINT ?? "";
const config = await loadConfig(blueprint);

test(`${blueprint} renders the demo story without errors`, async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(`console.error: ${message.text()}`);
    }
  });

  try {
    await page.goto("/");
    if (config.ready) {
      await page.waitForFunction(config.ready);
    }
    for (const text of config.expect) {
      await expect(page.getByText(text, { exact: true }).first()).toBeVisible();
    }
  } finally {
    // A missing text usually has its cause here, such as a rejected token.
    if (errors.length > 0) {
      console.error(errors.join("\n"));
    }
  }
  expect(errors).toEqual([]);
});
