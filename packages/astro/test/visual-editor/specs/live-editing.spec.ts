import { expect, test } from "@playwright/test";
import { QA_CONFIG } from "../config";
import { resolveStoryId, StoryblokEditor } from "../editor.page";

const SEEDED_HEADLINE = "QA teaser headline";

// Only what the real editor can exercise. Everything the playground renders
// standalone belongs in the Cypress suite (`pnpm --filter @storyblok/astro cy:run`).
//
// The story under test is `home`, served by `playground/ssr`'s `[...slug].astro`
// with `livePreview: true`: the bridge's `input` event POSTs the story back to
// the same URL and morphdom patches the response into the page.
test.describe("the Visual Editor live-updates the SSR playground", () => {
  test("the story renders inside the preview frame", async ({ page, request }) => {
    const editor = new StoryblokEditor(page);
    await editor.openStory(await resolveStoryId(request, "home"));

    await expect(editor.block("teaser-home-1")).toContainText(SEEDED_HEADLINE, { timeout: 60_000 });
    await expect(editor.block("feature-home-1")).toContainText("Feature 1");
    await expect(editor.block("featured-articles-home-1")).toContainText("Featured articles");
  });

  test("typing in a field updates the preview, before any save", async ({ page, request }) => {
    const editor = new StoryblokEditor(page);
    await editor.openStory(await resolveStoryId(request, "home"));
    await expect(editor.block("teaser-home-1")).toContainText(SEEDED_HEADLINE, { timeout: 60_000 });

    await editor.selectBlock("teaser-home-1", "headline");
    const edited = "QA teaser edited";
    await editor.textField("headline").fill(edited);

    // Asserts the observed change. A broken bridge throws nothing; it leaves the
    // old text in place until this expectation times out.
    await expect(editor.block("teaser-home-1")).toContainText(edited, { timeout: 30_000 });
  });

  test("a nested block updates live and its siblings survive", async ({ page, request }) => {
    const editor = new StoryblokEditor(page);
    await editor.openStory(await resolveStoryId(request, "home"));
    await expect(editor.block("feature-home-2")).toContainText("Feature 2", { timeout: 60_000 });

    // A block inside `grid.columns`, which takes the focused-element path: the
    // handler morphs only the `[data-blok-focused]` subtree, not the whole body.
    await editor.selectBlock("feature-home-2", "name");
    const edited = "nested feature edited";
    await editor.textField("name").fill(edited);

    await expect(editor.block("feature-home-2")).toContainText(edited, { timeout: 30_000 });
    await expect(editor.block("feature-home-1")).toContainText("Feature 1");
    await expect(editor.block("teaser-home-1")).toContainText(SEEDED_HEADLINE);
  });

  test("a resolved relation and server data survive a live edit", async ({ page, request }) => {
    const editor = new StoryblokEditor(page);
    await editor.openStory(await resolveStoryId(request, "home"));
    const posts = editor.preview.locator(".post-title");
    await expect(posts.first()).toContainText("First Article", { timeout: 60_000 });

    await editor.selectBlock("teaser-home-1", "headline");
    const edited = "QA teaser relation check";
    await editor.textField("headline").fill(edited);
    await expect(editor.block("teaser-home-1")).toContainText(edited, { timeout: 30_000 });

    // The bridge resolves relations separately from the page's own API call, so
    // a page can fetch them correctly and lose them on the first keystroke.
    await expect(posts).toHaveCount(2);
    await expect(posts.first()).toContainText("First Article");
    // `StoryblokServerData` ships the page's non-Storyblok data back with the
    // POST so the re-render does not refetch it. Losing it renders "0 users".
    await expect(editor.preview.locator("body")).toContainText("10 users loaded.");
  });

  test("preventDefault on the updating event blocks the update and preserves widget state", async ({
    page,
    request,
  }) => {
    const editor = new StoryblokEditor(page);
    await editor.openStory(await resolveStoryId(request, "home"));
    await expect(editor.block("teaser-home-1")).toContainText(SEEDED_HEADLINE, { timeout: 60_000 });

    await editor.selectBlock("teaser-home-1", "headline");
    const allowed = "QA teaser allowed";
    await editor.textField("headline").fill(allowed);
    await expect(editor.block("teaser-home-1")).toContainText(allowed, { timeout: 30_000 });

    // The playground's Widget calls preventDefault() on
    // `storyblok-live-preview-updating` while its checkbox is unchecked, and
    // carries `data-preserve-state` so morphdom leaves it alone.
    const checkbox = editor.preview.locator("#enableLivePreview");
    await checkbox.uncheck();
    const blocked = "QA teaser blocked";
    await editor.textField("headline").fill(blocked);
    await page.waitForTimeout(6000);
    await expect(editor.block("teaser-home-1")).toContainText(allowed);
    await expect(editor.block("teaser-home-1")).not.toContainText(blocked);
    await expect(checkbox).not.toBeChecked();

    await checkbox.check();
    const resumed = "QA teaser resumed";
    await editor.textField("headline").fill(resumed);
    await expect(editor.block("teaser-home-1")).toContainText(resumed, { timeout: 30_000 });
  });

  test("the disable meta tag suppresses live updates", async ({ page, request }) => {
    const editor = new StoryblokEditor(page);
    // `[...slug].astro` renders <meta name="storyblok-live-preview"
    // content="disabled"> for this slug.
    await editor.openStory(await resolveStoryId(request, "test"));
    const teaser = editor.block("teaser-test-1");
    await expect(teaser).toContainText("Live preview disabled teaser", { timeout: 60_000 });

    await editor.selectBlock("teaser-test-1", "headline");
    await editor.textField("headline").fill("should not appear");
    await page.waitForTimeout(6000);
    await expect(teaser).toContainText("Live preview disabled teaser");
    await expect(teaser).not.toContainText("should not appear");
  });
});

// These persist content, so they run last and leave the space mutated: the
// preflight tells the next run to re-seed.
test.describe("saving and publishing re-render the preview", () => {
  test("save reloads the preview with the saved content", async ({ page, request }) => {
    const editor = new StoryblokEditor(page);
    await editor.openStory(await resolveStoryId(request, "home"));
    await expect(editor.block("teaser-home-1")).toContainText(SEEDED_HEADLINE, { timeout: 60_000 });

    await editor.selectBlock("teaser-home-1", "headline");
    const saved = "QA teaser saved";
    await editor.textField("headline").fill(saved);
    // `save()` waits for the reload the `change` handler triggers. Asserting the
    // text alone would pass with a dead reload path: the live update already put
    // it there.
    await editor.save();

    await expect(editor.block("teaser-home-1")).toContainText(saved, { timeout: 60_000 });
    await expect(editor.block("teaser-home-1")).not.toContainText(SEEDED_HEADLINE);
  });

  test("publish reloads the preview with the published content", async ({ page, request }) => {
    const editor = new StoryblokEditor(page);
    const storyId = await resolveStoryId(request, "home");
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
