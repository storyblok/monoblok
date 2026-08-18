import { expect, test } from "@playwright/test";
import { QA_CONFIG } from "../config";
import { resolveStoryId, StoryblokEditor } from "../editor.page";

test.describe("index.vue — useAsyncStoryblok with an explicit bridge", () => {
  test("renders the story standalone, outside the editor", async ({ page }) => {
    await page.goto(`${QA_CONFIG.previewBaseUrl}/vue`);
    await expect(page.locator('[data-test="teaser"]')).toContainText("QA teaser");
  });

  test("renders inside the editor preview frame", async ({ page, request }) => {
    const editor = new StoryblokEditor(page);
    await editor.openStory(await resolveStoryId(request, "vue"));

    await expect(editor.block("page")).toBeVisible({ timeout: 60_000 });
    await expect(editor.block("teaser")).toContainText("QA teaser");
    await expect(editor.block("feature")).toHaveCount(2);
  });

  test("updates the preview on input, before any save", async ({ page, request }) => {
    const editor = new StoryblokEditor(page);
    await editor.openStory(await resolveStoryId(request, "vue"));
    await expect(editor.block("teaser")).toContainText("QA teaser");

    // Select the teaser block. Its `headline` is what Teaser.vue renders;
    // the story-level `page.headline` is not rendered at all.
    await editor.selectBlock("teaser", "headline");

    const edited = "QA teaser edited";
    await editor.textField("headline").fill(edited);

    // Asserts the observed change. A broken bridge throws nothing; it just
    // leaves the old text in place until this expectation times out.
    await expect(editor.block("teaser")).toContainText(edited, { timeout: 30_000 });
  });
});
