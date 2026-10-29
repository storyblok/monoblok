import { expect, test } from "@playwright/test";
import { resolveStoryId, StoryblokEditor } from "@storyblok/visual-editor-qa";
import { QA_CONFIG } from "../qa.config";

const SEEDED_HEADLINE = "QA teaser headline";

test.describe("the Visual Editor live-updates the Svelte playground", () => {
  test("renders the seeded story and nested blocks", async ({ page, request }) => {
    const editor = new StoryblokEditor(page, QA_CONFIG);
    await editor.openStory(await resolveStoryId(QA_CONFIG, request, "home"));

    await expect(editor.block("teaser-home-1")).toContainText(SEEDED_HEADLINE, {
      timeout: 60_000,
    });
    await expect(editor.block("feature-home-1")).toContainText("Feature 1");
    await expect(editor.block("featured-articles-home-1")).toContainText("First Article");
  });

  test("typing in a field updates the preview before saving", async ({ page, request }) => {
    const editor = new StoryblokEditor(page, QA_CONFIG);
    await editor.openStory(await resolveStoryId(QA_CONFIG, request, "home"));
    await expect(editor.block("teaser-home-1")).toContainText(SEEDED_HEADLINE, {
      timeout: 60_000,
    });

    await editor.selectBlock("teaser-home-1", "headline");
    await editor.textField("headline").fill("QA teaser edited");

    await expect(editor.block("teaser-home-1")).toContainText("QA teaser edited", {
      timeout: 30_000,
    });
    await expect(editor.block("featured-articles-home-1")).toContainText("First Article", {
      timeout: 30_000,
    });
  });
});
