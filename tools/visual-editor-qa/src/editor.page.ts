import { expect } from "@playwright/test";
import type { APIRequestContext, FrameLocator, Locator, Page } from "@playwright/test";
import type { QaConfig } from "./config";

/** Resolves a story's numeric id, which the editor URL and the bridge both key on. */
export const resolveStoryId = async (
  config: QaConfig,
  request: APIRequestContext,
  fullSlug: string,
): Promise<number> => {
  const response = await request.get(
    `${config.mapiBaseUrl}/spaces/${config.spaceId}/stories?per_page=100`,
    { headers: { Authorization: config.managementToken } },
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
    throw new Error(`Story "${fullSlug}" is not in space ${config.spaceId}. Seed it first.`);
  }
  return story.id;
};

/**
 * Every selector that belongs to the Storyblok app lives here. The app changes
 * without notice; keeping them in one place makes a broken release one repair.
 * Nothing in here is framework-specific, because the app is not.
 */
export class StoryblokEditor {
  readonly preview: FrameLocator;
  /**
   * Counts loads of the preview iframe. The bridge replaces the story in place
   * before you save, so "the preview shows the new text" is already true when
   * the save or publish reload path is dead. Only a navigation proves the reload.
   */
  private previewLoads = 0;

  constructor(
    private readonly page: Page,
    private readonly config: QaConfig,
  ) {
    this.preview = page.frameLocator("#storyblok-preview");
    page.on("framenavigated", (frame) => {
      if (frame.url().startsWith(config.previewBaseUrl)) {
        this.previewLoads++;
      }
    });
  }

  async openStory(storyId: number): Promise<void> {
    const { appBaseUrl, spaceId } = this.config;
    const alreadyInApp = this.page.url().startsWith(appBaseUrl);
    await this.page.goto(`${appBaseUrl}/#/me/spaces/${spaceId}/stories/0/0/${storyId}`, {
      waitUntil: "domcontentloaded",
    });
    // A hash-only change is an SPA route change: the app swaps the form but the
    // preview iframe keeps the previously opened story. Every later assertion
    // then times out against the wrong page and reads as a dead bridge.
    if (alreadyInApp) {
      await this.page.reload({ waitUntil: "domcontentloaded" });
    }
    // Assert the app rendered the frame, so a later preview failure cannot be
    // confused with the editor never loading.
    await expect(this.page.getByTestId("editor-form")).toBeVisible({ timeout: 60_000 });
    await expect(this.page.locator("#storyblok-preview")).toBeVisible({ timeout: 60_000 });
  }

  /**
   * A block in the preview, addressed by the `_uid` the scenario seeded. Every
   * SDK's editable directive emits `data-blok-uid="<storyId>-<uid>"`, so this
   * needs no test-only attributes in the playground's components.
   */
  block(uid: string): Locator {
    return this.preview.locator(`[data-blok-uid$="-${uid}"]`);
  }

  /**
   * Clicks a block in the preview so the editor opens that block's own form.
   * Without this, `textField` addresses the story-level fields, and editing
   * `page.headline` changes nothing a block renders.
   */
  async selectBlock(uid: string, expectFieldName: string): Promise<void> {
    const field = this.textField(expectFieldName);
    // The story-level form carries fields with the same technical names as its
    // blocks, so asserting the field is merely visible proves nothing: it is
    // visible either way, and a click that failed to switch forms then edits the
    // STORY field. The input id encodes the owning block
    // (`<storyId>__<fieldName>-<blokUid>`), so asserting it names this block is
    // the only evidence the editor moved.
    const currentFieldId = async (): Promise<string | null> =>
      (await field.count()) > 0 ? field.getAttribute("id") : null;

    // The bridge's click handler is not ready the instant the preview paints, so
    // the first click is sometimes swallowed. Retry rather than sleep: a fixed
    // wait is either too short on a cold start or wasted on a warm one.
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
    // A story whose relations point at unpublished stories, which every fresh
    // seed does, gets a confirmation modal. It takes a moment to render, so a
    // bare `count()` here races it, the publish never happens, and the missing
    // reload reads as a broken bridge.
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
