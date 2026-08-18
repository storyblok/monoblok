import { expect, test } from "@playwright/test";
import { QA_CONFIG } from "../config";
import { resolveStoryId, StoryblokEditor } from "../editor.page";

/** A raw, unresolved reference: the relation did not resolve. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-/;

test.describe("resolveRelations survives a live edit", () => {
  test("the relation resolves on a standalone load", async ({ page, request }) => {
    // Guards the spec below: a relation that never resolved cannot be observed
    // to survive anything.
    const storyId = await resolveStoryId(request, "vue");
    const response = await request.get(
      `https://mapi.storyblok.com/v1/spaces/${QA_CONFIG.spaceId}/stories/${storyId}`,
      { headers: { Authorization: QA_CONFIG.managementToken } },
    );
    const { story } = await response.json();
    const block = story.content.body.find(
      (entry: { component: string }) => entry.component === "popular-articles",
    );

    expect(
      block?.articles ?? [],
      "popular-articles has no references. Run: node packages/nuxt/test/visual-editor/link-relations.mjs",
    ).toHaveLength(2);

    await page.goto(`${QA_CONFIG.previewBaseUrl}/vue`);

    // Resolved: the article's title. Unresolved: its raw UUID.
    const items = page.locator('[data-test="popular-article"]');
    await expect(items).toHaveCount(2);
    await expect(items.first()).toContainText("First article");
    await expect(items.first()).not.toHaveText(UUID_PATTERN);
  });

  test("the relation stays resolved after an edit in the editor", async ({ page, request }) => {
    const editor = new StoryblokEditor(page);
    await editor.openStory(await resolveStoryId(request, "vue"));

    const items = editor.preview.locator('[data-test="popular-article"]');
    await expect(items.first()).toContainText("First article", { timeout: 60_000 });

    // Edit an unrelated block, so the only thing under test is whether the
    // bridge's replacement payload kept the relations resolved.
    await editor.selectBlock("teaser", "headline");
    await editor.textField("headline").fill("QA teaser relation check");
    await expect(editor.block("teaser")).toContainText("QA teaser relation check", {
      timeout: 30_000,
    });

    // The assertion this whole harness exists for: after the bridge replaced the
    // story, the relation is still a story object and not a bare UUID.
    await expect(items.first()).toContainText("First article");
    await expect(items.first()).not.toHaveText(UUID_PATTERN);
  });
});
