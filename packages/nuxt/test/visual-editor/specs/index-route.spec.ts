import { expect, test } from "@playwright/test";
import { QA_CONFIG } from "../config";

// index.vue is route "/" and, unlike [...slug].vue, configures
// `bridge: { resolveRelations: "popular-articles.articles" }` explicitly. It
// fetches the same story ("vue"), so the same seeded content renders here.
test("index.vue renders the story standalone, outside the editor", async ({ page }) => {
  await page.goto(`${QA_CONFIG.previewBaseUrl}/`);
  await expect(page.locator('[data-test="teaser"]')).toContainText("QA teaser");
});
