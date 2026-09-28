import { expect, test } from "@playwright/test";
import { resolveStoryId, StoryblokEditor } from "@storyblok/visual-editor-qa";
import { QA_CONFIG } from "../qa.config";

const SEEDED_HEADLINE = "QA teaser headline";

// Only what the real editor can exercise. The story under test is `home`,
// served by the catch-all route.
test.describe("the Visual Editor live-updates the playground", () => {
  test("the story renders inside the preview frame", async ({ page, request }) => {
    const editor = new StoryblokEditor(page, QA_CONFIG);
    await editor.openStory(await resolveStoryId(QA_CONFIG, request, "home"));

    await expect(editor.block("teaser-home-1")).toContainText(SEEDED_HEADLINE, { timeout: 60_000 });
    await expect(editor.block("feature-home-1")).toContainText("Feature 1");
    await expect(editor.block("featured-articles-home-1")).toContainText("Featured articles");
  });

  test("typing in a field updates the preview, before any save", async ({ page, request }) => {
    const editor = new StoryblokEditor(page, QA_CONFIG);
    await editor.openStory(await resolveStoryId(QA_CONFIG, request, "home"));
    await expect(editor.block("teaser-home-1")).toContainText(SEEDED_HEADLINE, { timeout: 60_000 });

    await editor.selectBlock("teaser-home-1", "headline");
    const edited = "QA teaser edited";
    await editor.textField("headline").fill(edited);

    // Asserts the observed change. A broken bridge throws nothing; it leaves
    // the old text in place until this expectation times out.
    await expect(editor.block("teaser-home-1")).toContainText(edited, { timeout: 30_000 });
  });

  test("a nested block updates live and its siblings survive", async ({ page, request }) => {
    const editor = new StoryblokEditor(page, QA_CONFIG);
    await editor.openStory(await resolveStoryId(QA_CONFIG, request, "home"));
    await expect(editor.block("feature-home-2")).toContainText("Feature 2", { timeout: 60_000 });

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

    await editor.selectBlock("teaser-home-1", "headline");
    const edited = "QA teaser relation check";
    await editor.textField("headline").fill(edited);
    await expect(editor.block("teaser-home-1")).toContainText(edited, { timeout: 30_000 });

    // The bridge replaces the whole story, so a resolved relation surviving
    // proves the replacement kept it resolved rather than falling back to a
    // bare uuid.
    await expect(posts).toHaveCount(2);
    await expect(posts.first()).toContainText("First article");
  });

  test("a page not wired through the bridge never updates", async ({ page, request }) => {
    const editor = new StoryblokEditor(page, QA_CONFIG);
    await editor.openStory(await resolveStoryId(QA_CONFIG, request, "home"));
    const staticHeadline = editor.preview.locator('[data-test="static-teaser-headline"]');
    await expect(staticHeadline).toContainText(SEEDED_HEADLINE, { timeout: 60_000 });

    await editor.selectBlock("teaser-home-1", "headline");
    const edited = "QA teaser opt-out check";
    await editor.textField("headline").fill(edited);

    // The bridge-enabled render proves the edit reached the bridge at all;
    // without it, a page that never updates is indistinguishable from a dead
    // bridge, not evidence that this render is genuinely bridge-disabled.
    await expect(editor.block("teaser-home-1")).toContainText(edited, { timeout: 30_000 });
    await expect(staticHeadline).toContainText(SEEDED_HEADLINE);
    await expect(staticHeadline).not.toContainText(edited);
  });
});

// This persists content, so it runs last and leaves the space mutated: the
// preflight tells the next run to re-seed.
test.describe("saving and publishing re-render the preview", () => {
  test("save reloads the preview with the saved content", async ({ page, request }) => {
    const editor = new StoryblokEditor(page, QA_CONFIG);
    await editor.openStory(await resolveStoryId(QA_CONFIG, request, "home"));
    await expect(editor.block("teaser-home-1")).toContainText(SEEDED_HEADLINE, { timeout: 60_000 });

    await editor.selectBlock("teaser-home-1", "headline");
    const saved = "QA teaser saved";
    await editor.textField("headline").fill(saved);
    // `save()` waits for the reload the `change` handler triggers. Asserting
    // the text alone would pass with a dead reload path: the live update
    // already put it there.
    await editor.save();

    await expect(editor.block("teaser-home-1")).toContainText(saved, { timeout: 60_000 });
    await expect(editor.block("teaser-home-1")).not.toContainText(SEEDED_HEADLINE);
    // The reload refetches through the same static, non-bridge path too.
    await expect(editor.preview.locator('[data-test="static-teaser-headline"]')).toContainText(
      saved,
    );
  });

  test("publish reloads the preview with the published content", async ({ page, request }) => {
    const editor = new StoryblokEditor(page, QA_CONFIG);
    const storyId = await resolveStoryId(QA_CONFIG, request, "home");
    await editor.openStory(storyId);
    await expect(editor.block("teaser-home-1")).toBeVisible({ timeout: 60_000 });

    await editor.selectBlock("teaser-home-1", "headline");
    const published = "QA teaser published";
    await editor.textField("headline").fill(published);
    await editor.publish();

    await expect(editor.block("teaser-home-1")).toContainText(published, { timeout: 60_000 });
    // A reload proves nothing if the confirmation modal swallowed the publish.
    const response = await request.get(
      `${QA_CONFIG.mapiBaseUrl}/spaces/${QA_CONFIG.spaceId}/stories/${storyId}`,
      { headers: { Authorization: QA_CONFIG.managementToken } },
    );
    const { story } = await response.json();
    expect(story.published, "the story is still unpublished").toBe(true);
  });
});
