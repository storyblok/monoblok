import type { APIRequestContext, FrameLocator, Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { QA_CONFIG } from "./config";

/** Resolves a story's numeric id, which the editor URL and the bridge both key on. */
export const resolveStoryId = async (
  request: APIRequestContext,
  fullSlug: string,
): Promise<number> => {
  const response = await request.get(
    `${QA_CONFIG.mapiBaseUrl}/spaces/${QA_CONFIG.spaceId}/stories?per_page=100`,
    { headers: { Authorization: QA_CONFIG.managementToken } },
  );
  if (!response.ok()) {
    throw new Error(
      `Could not list stories over MAPI (status ${response.status()}). ` +
        "The token likely expired or does not have access to this space.",
    );
  }
  const { stories } = await response.json();
  const story = stories.find(
    (entry: { full_slug: string }) => entry.full_slug.replace(/\/$/, "") === fullSlug,
  );
  if (!story) {
    throw new Error(`Story "${fullSlug}" is not in space ${QA_CONFIG.spaceId}. Seed it first.`);
  }
  return story.id;
};

/**
 * Every selector that belongs to the Storyblok app lives here. The app changes
 * without notice; keeping them in one place makes a broken release one repair.
 */
export class StoryblokEditor {
  readonly preview: FrameLocator;
  /**
   * Counts loads of the preview iframe. Live preview morphs the new text into
   * the page *before* you save, so "the preview shows the new text" is already
   * true when the reload path is dead. Only a navigation proves the reload.
   */
  private previewLoads = 0;

  constructor(private readonly page: Page) {
    this.preview = page.frameLocator("#storyblok-preview");
    page.on("framenavigated", (frame) => {
      if (frame.url().startsWith(QA_CONFIG.previewBaseUrl)) {
        this.previewLoads++;
      }
    });
  }

  async openStory(storyId: number): Promise<void> {
    const url = `${QA_CONFIG.appBaseUrl}/#/me/spaces/${QA_CONFIG.spaceId}/stories/0/0/${storyId}`;
    const alreadyInApp = this.page.url().startsWith(QA_CONFIG.appBaseUrl);
    await this.page.goto(url, { waitUntil: "domcontentloaded" });
    // A hash-only change is an SPA route change: the app swaps the form but the
    // preview iframe keeps the previously opened story. Every assertion then
    // times out against the wrong page, which reads as a dead bridge.
    if (alreadyInApp) {
      await this.page.reload({ waitUntil: "domcontentloaded" });
    }
    // Assert the app rendered the frame, so a later preview failure cannot be
    // confused with the editor never loading.
    await expect(this.page.getByTestId("editor-form")).toBeVisible({ timeout: 60_000 });
    await expect(this.page.locator("#storyblok-preview")).toBeVisible({ timeout: 60_000 });
  }

  /**
   * A block in the preview, addressed by the `_uid` the scenario seeded.
   * `storyblokEditable` emits `data-blok-uid="<storyId>-<uid>"`, so this works
   * without the app components carrying test-only attributes.
   */
  block(uid: string): Locator {
    return this.preview.locator(`[data-blok-uid$="-${uid}"]`);
  }

  /**
   * Clicks a block in the preview so the editor opens that block's own form.
   * Without this, `textField` addresses the story-level fields.
   */
  async selectBlock(uid: string, expectFieldName: string): Promise<void> {
    const field = this.textField(expectFieldName);
    // The story-level form carries fields with the same technical names as its
    // blocks, so asserting the field is merely visible proves nothing — a click
    // that failed to switch forms then edits the STORY field. The input id
    // encodes the owning block (`<storyId>__<fieldName>-<blokUid>`); asserting
    // it names this block is the only evidence the editor moved.
    const currentFieldId = async (): Promise<string | null> =>
      (await field.count()) > 0 ? field.getAttribute("id") : null;

    // The bridge's click handler is not ready the instant the preview paints, so
    // the first click is sometimes swallowed. Retry rather than sleep.
    for (let attempt = 1; attempt <= 3; attempt++) {
      await this.block(uid).first().click();
      try {
        await expect.poll(currentFieldId, { timeout: 5000, intervals: [250] }).toContain(uid);
        return;
      } catch {
        if (attempt === 3) {
          throw new Error(
            `Clicking [data-blok-uid$="-${uid}"] did not switch the editor to that block's form ` +
              `after 3 attempts (field "${expectFieldName}" is still owned by ${await currentFieldId()}).`,
          );
        }
      }
    }
  }

  /**
   * A text input in the editor's form panel, addressed by the field's
   * *technical* name (`headline`, not "Headline"). Visible labels are
   * translated and re-worded; the input id carries the schema key.
   */
  textField(fieldName: string): Locator {
    return this.page.locator(".sb-textfield").locator(`input[id*="${fieldName}"]`).first();
  }

  /** Saves, and waits for the reload the bridge's `change` handler triggers. */
  async save(): Promise<void> {
    const before = this.previewLoads;
    // The app takes the field's value from its own model, which lags `fill()`.
    // Clicking Save the same instant persists the PREVIOUS value, and the
    // reloaded preview then looks stale for no visible reason.
    await this.page.waitForTimeout(2000);
    await this.page.getByTestId("editor-header-save").click();
    await this.expectPreviewReload(before);
  }

  /** Publishes, dismissing the unpublished-relations confirmation, and waits for the reload. */
  async publish(): Promise<void> {
    const before = this.previewLoads;
    await this.page.waitForTimeout(2000);
    await this.page.getByTestId("editor-header-publish").click();
    // A story whose relations point at unpublished stories — which every fresh
    // seed does — gets a confirmation modal. The modal takes a moment to render,
    // so a bare `count()` here races it, the publish never happens, and the
    // missing reload reads as a broken bridge.
    const anyway = this.page.getByRole("button", { name: /Publish anyway/i }).first();
    try {
      await anyway.waitFor({ timeout: 10_000 });
      await anyway.click();
    } catch {
      // No confirmation: the publish went straight through.
    }
    await this.expectPreviewReload(before);
  }

  private async expectPreviewReload(before: number): Promise<void> {
    await expect.poll(() => this.previewLoads, { timeout: 60_000 }).toBeGreaterThan(before);
  }
}
