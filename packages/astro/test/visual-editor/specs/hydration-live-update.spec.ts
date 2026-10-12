import { expect, test } from "@playwright/test";
import { resolveStoryId, StoryblokEditor } from "@storyblok/visual-editor-qa";
import { QA_CONFIG } from "../qa.config";

// Regression test: a `client:visible` island added only via a live-preview
// DOM morph (not a fresh navigation) never hydrates — Astro's inline runtime
// `<script>` keeps the HTML spec's "already started" flag when inserted via
// `DOMParser`. `client:load` is the control: it hydrates on initial render.
test.describe("a client directive introduced only by a live-preview DOM morph", () => {
  test("client:load, present since the initial render, hydrates", async ({ page, request }) => {
    const editor = new StoryblokEditor(page, QA_CONFIG);
    await editor.openStory(await resolveStoryId(QA_CONFIG, request, "hydration"));

    const loadCounter = editor.preview.locator('[data-test="load-counter"]');
    await expect(loadCounter).toBeVisible({ timeout: 60_000 });
    // Wait for the island to finish hydrating before clicking. Scoped to the
    // counter: the editor-only Widget also renders a `client:load` island.
    await expect(
      editor.preview.locator('astro-island[client="load"]', { has: loadCounter }),
    ).not.toHaveAttribute("ssr", { timeout: 30_000 });
    await loadCounter.getByRole("button", { name: "+" }).click();
    await expect(editor.preview.locator('[data-test="load-counter-count"]')).toHaveText("1");
  });

  test("client:visible, added through the editor after the page was already open, hydrates once scrolled into view", async ({
    page,
    request,
  }) => {
    const editor = new StoryblokEditor(page, QA_CONFIG);
    await editor.openStory(await resolveStoryId(QA_CONFIG, request, "hydration"));
    await expect(editor.preview.locator('[data-test="load-counter"]')).toBeVisible({
      timeout: 60_000,
    });

    // Not seeded: `react_counter` is pushed as a component but never placed.
    await editor.addBlock("React Counter (client:visible)");

    const visibleCounter = editor.preview.locator('[data-test="visible-counter"]');
    await expect(visibleCounter).toBeAttached({ timeout: 15_000 });
    await visibleCounter.scrollIntoViewIfNeeded();

    await visibleCounter.getByRole("button", { name: "+" }).click();
    // A broken bridge/morph leaves the click inert; assert the increment.
    await expect(editor.preview.locator('[data-test="visible-counter-count"]')).toHaveText("1", {
      timeout: 10_000,
    });
  });
});
