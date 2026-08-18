import { expect, test } from "@playwright/test";
import { resolveStoryId, StoryblokEditor } from "../editor.page";

test("[...slug].vue updates the preview on input", async ({ page, request }) => {
  const editor = new StoryblokEditor(page);
  await editor.openStory(await resolveStoryId(request, "vue/test"));

  await expect(editor.block("teaser")).toContainText("hello");
  await expect(editor.block("feature")).toHaveCount(2);

  await editor.selectBlock("teaser", "headline");
  await editor.textField("headline").fill("hello edited");
  await expect(editor.block("teaser")).toContainText("hello edited", { timeout: 30_000 });
});
