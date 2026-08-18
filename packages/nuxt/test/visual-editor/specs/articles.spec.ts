import { expect, test } from "@playwright/test";
import { QA_CONFIG } from "../config";
import { resolveStoryId, StoryblokEditor } from "../editor.page";

test("articles/index.vue lists the seeded articles standalone", async ({ page }) => {
  await page.goto(`${QA_CONFIG.previewBaseUrl}/articles`);
  await expect(page.getByRole("heading", { name: "First Article" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Second Article" })).toBeVisible();
});

test("an article story updates its title on input", async ({ page, request }) => {
  const editor = new StoryblokEditor(page);
  await editor.openStory(await resolveStoryId(request, "vue/articles/first-article"));

  // The editor previews a story at its own `full_slug`, i.e.
  // /vue/articles/first-article — served by the catch-all route, NOT by
  // pages/articles/[slug].vue, which lives at /articles/:slug. So the block
  // under test is what Article.vue renders, not that page's markup.
  await expect(editor.block("article")).toContainText("First article", { timeout: 60_000 });

  await editor.selectBlock("article", "title");
  await editor.textField("title").fill("First article edited");
  await expect(editor.block("article")).toContainText("First article edited", {
    timeout: 30_000,
  });
});
