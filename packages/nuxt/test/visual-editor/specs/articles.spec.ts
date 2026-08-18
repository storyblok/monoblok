import { expect, test } from "@playwright/test";
import { QA_CONFIG } from "../config";
import { resolveStoryId, StoryblokEditor } from "../editor.page";

test("articles/index.vue lists the seeded articles standalone", async ({ page }) => {
  await page.goto(`${QA_CONFIG.previewBaseUrl}/articles`);
  await expect(page.getByRole("heading", { name: "First Article" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Second Article" })).toBeVisible();
});

test("articles/[slug].vue updates the title on input", async ({ page, request }) => {
  const editor = new StoryblokEditor(page);
  await editor.openStory(await resolveStoryId(request, "vue/articles/first-article"));

  await expect(editor.preview.locator("h2")).toContainText("First article");

  await editor.textField("title").fill("First article edited");
  await expect(editor.preview.locator("h2")).toContainText("First article edited", {
    timeout: 30_000,
  });
});
