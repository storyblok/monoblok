import { expect, test } from "@playwright/test";
import { QA_CONFIG } from "../config";
import { resolveStoryId, StoryblokEditor } from "../editor.page";

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

test("richtext.vue updates the rendered document on input", async ({ page, request }) => {
  const editor = new StoryblokEditor(page);
  await editor.openStory(await resolveStoryId(request, "vue/test-richtext"));

  await expect(editor.preview.getByRole("heading", { name: "Headline 1" })).toBeVisible({
    timeout: 60_000,
  });
});
