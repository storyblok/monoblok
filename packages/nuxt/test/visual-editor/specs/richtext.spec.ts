import { expect, test } from "@playwright/test";
import { QA_CONFIG } from "../config";

test("richtext.vue maps story links and url links differently", async ({ page }) => {
  await page.goto(`${QA_CONFIG.previewBaseUrl}/richtext`);

  await expect(page.getByRole("heading", { name: "Headline 1" })).toBeVisible();
  // The story link renders through NuxtLink, so it stays a same-tab href.
  await expect(page.getByRole("link", { name: "first article" })).toHaveAttribute(
    "href",
    "/vue/articles/first-article",
  );
  // The url link renders through the plain <a> branch, which adds rel on _blank.
  await expect(page.getByRole("link", { name: "storyblok.com" })).toHaveAttribute(
    "rel",
    "noopener noreferrer",
  );
});

// Live editing of a richtext field is NOT covered by this harness: driving the
// editor's contenteditable richtext toolbar is brittle, so this test covers
// in-editor rendering only, not that an edit propagates through the bridge.
// There is deliberately no in-editor test for richtext. The editor previews a
// story at its `full_slug` (/vue/test-richtext), which the catch-all route
// serves through Page.vue — and Page.vue renders `body`, not `richText`. So the
// richtext output is not reachable from the editor without changing what the
// playground renders. Live editing of a richtext field is out of scope anyway:
// driving the editor's contenteditable is brittle. Standalone coverage above.
