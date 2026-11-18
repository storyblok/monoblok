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

  test("a nested block updates live and its siblings survive", async ({ page, request }) => {
    const editor = new StoryblokEditor(page, QA_CONFIG);
    await editor.openStory(await resolveStoryId(QA_CONFIG, request, "home"));
    await expect(editor.block("feature-home-2")).toContainText("Feature 2", { timeout: 60_000 });

    // A block inside `grid.columns`, not a direct child of the story body.
    await editor.selectBlock("feature-home-2", "name");
    const edited = "nested feature edited";
    await editor.textField("name").fill(edited);

    await expect(editor.block("feature-home-2")).toContainText(edited, { timeout: 30_000 });
    await expect(editor.block("feature-home-1")).toContainText("Feature 1");
    await expect(editor.block("teaser-home-1")).toContainText(SEEDED_HEADLINE);
  });

  test("a resolved relation survives a live edit", async ({ page, request }) => {
    const editor = new StoryblokEditor(page, QA_CONFIG);
    await editor.openStory(await resolveStoryId(QA_CONFIG, request, "home"));
    const posts = editor.preview.locator(".post-title");
    await expect(posts.first()).toContainText("First Article", { timeout: 60_000 });

    // Edit an unrelated block: the only thing under test is whether the
    // bridge's replacement story kept `posts` resolved.
    await editor.selectBlock("teaser-home-1", "headline");
    const edited = "QA teaser relation check";
    await editor.textField("headline").fill(edited);
    await expect(editor.block("teaser-home-1")).toContainText(edited, { timeout: 30_000 });

    await expect(posts).toHaveCount(2);
    await expect(posts.first()).toContainText("First Article");
    await expect(posts.last()).toContainText("Second Article");
  });
});
