import { expect, test } from "@playwright/test";
import { resolveStoryId, StoryblokEditor } from "@storyblok/visual-editor-qa";
import { QA_CONFIG } from "../qa.config";

/** A raw, unresolved reference: the relation did not resolve. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-/;

// The three checks that need the real editor. Everything else the playground
// renders is standalone behaviour and belongs in the Cypress suite (`cy:run`).
//
// The story under test is "vue", which the catch-all route `[...slug].vue`
// serves. That route configures `bridge: {}` and inherits `resolveRelations`
// from `api.resolve_relations` through the composable's
// `bridge.resolveRelations ?? toValue(api).resolve_relations` fallback, so the
// inheritance path is covered here too.
test.describe("the Visual Editor renders and live-updates the playground", () => {
  test("the story renders inside the preview frame", async ({ page, request }) => {
    const editor = new StoryblokEditor(page, QA_CONFIG);
    await editor.openStory(await resolveStoryId(QA_CONFIG, request, "vue"));

    // No assertion on the page root: the story's own `_uid` is assigned remotely,
    // so the scenario cannot seed a stable one for it. Its blocks are the proof.
    await expect(editor.block("teaser-start-1")).toContainText("QA teaser", { timeout: 60_000 });
    await expect(editor.block("feature-start-1")).toContainText("Feature 1");
    await expect(editor.block("feature-start-2")).toContainText("Feature 2");
  });

  test("typing in a field updates the preview, before any save", async ({ page, request }) => {
    const editor = new StoryblokEditor(page, QA_CONFIG);
    await editor.openStory(await resolveStoryId(QA_CONFIG, request, "vue"));
    await expect(editor.block("teaser-start-1")).toContainText("QA teaser", { timeout: 60_000 });

    // Select the teaser block. Its `headline` is what Teaser.vue renders;
    // the story-level `page.headline` is not rendered at all.
    await editor.selectBlock("teaser-start-1", "headline");

    const edited = "QA teaser edited";
    await editor.textField("headline").fill(edited);

    // Asserts the observed change. A broken bridge throws nothing; it just
    // leaves the old text in place until this expectation times out.
    await expect(editor.block("teaser-start-1")).toContainText(edited, { timeout: 30_000 });
  });

  test("a resolved relation survives a live edit", async ({ page, request }) => {
    const editor = new StoryblokEditor(page, QA_CONFIG);
    await editor.openStory(await resolveStoryId(QA_CONFIG, request, "vue"));

    // Resolved: the article's title. Unresolved: its raw UUID.
    const items = editor.preview.locator('[data-test="popular-article"]');
    await expect(items.first()).toContainText("First article", { timeout: 60_000 });

    // Edit an unrelated block, so the only thing under test is whether the
    // bridge's replacement payload kept the relations resolved.
    await editor.selectBlock("teaser-start-1", "headline");
    await editor.textField("headline").fill("QA teaser relation check");
    await expect(editor.block("teaser-start-1")).toContainText("QA teaser relation check", {
      timeout: 30_000,
    });

    // The assertion this whole harness exists for: after the bridge replaced the
    // story, the relation is still a story object and not a bare UUID.
    await expect(items).toHaveCount(2);
    await expect(items.first()).toContainText("First article");
    await expect(items.first()).not.toHaveText(UUID_PATTERN);
  });
});
