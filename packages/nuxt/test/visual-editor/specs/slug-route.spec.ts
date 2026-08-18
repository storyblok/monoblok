import { expect, test } from "@playwright/test";
import { QA_CONFIG } from "../config";
import { resolveStoryId, StoryblokEditor } from "../editor.page";

// This route ([...slug].vue) configures `bridge: {}` and inherits
// `resolveRelations` from `api.resolve_relations` via the composable's
// `bridge.resolveRelations ?? toValue(api).resolve_relations` fallback. That
// inheritance path is deliberately the one under test here; see
// index-route.spec.ts for a page that configures `bridge` explicitly.
test.describe("[...slug].vue — bridge options inherited from api", () => {
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
