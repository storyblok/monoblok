import type { APIRequestContext, FrameLocator, Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { QA_CONFIG } from "./config";

/** Resolves a story's numeric id, which the editor URL and the bridge both key on. */
export const resolveStoryId = async (
  request: APIRequestContext,
  fullSlug: string,
): Promise<number> => {
  const response = await request.get(
    `https://mapi.storyblok.com/v1/spaces/${QA_CONFIG.spaceId}/stories?per_page=100`,
    { headers: { Authorization: QA_CONFIG.managementToken } },
  );
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

  constructor(private readonly page: Page) {
    this.preview = page.frameLocator("#storyblok-preview");
  }

  async openStory(storyId: number): Promise<void> {
    await this.page.goto(
      `${QA_CONFIG.appBaseUrl}/#/me/spaces/${QA_CONFIG.spaceId}/stories/0/0/${storyId}`,
      { waitUntil: "domcontentloaded" },
    );
    // Assert the app rendered the frame, so a later preview failure cannot be
    // confused with the editor never loading.
    await expect(this.page.getByTestId("editor-form")).toBeVisible({ timeout: 60_000 });
    await expect(this.page.locator("#storyblok-preview")).toBeVisible({ timeout: 60_000 });
  }

  /** A block rendered by the playground, addressed by its `data-test` attribute. */
  block(dataTest: string): Locator {
    return this.preview.locator(`[data-test="${dataTest}"]`);
  }

  /**
   * Clicks a block in the preview so the editor opens that block's own form.
   * Without this, `textField` addresses the story-level fields, and editing
   * `page.headline` changes nothing the playground renders.
   */
  async selectBlock(dataTest: string): Promise<void> {
    await this.block(dataTest).first().click();
    // The block's own form replaced the story form. Assert it, so a failed
    // selection cannot be mistaken for a bridge that never fired.
    await expect(this.page.getByTestId("editor-form")).toBeVisible();
  }

  /**
   * A text input in the editor's form panel, addressed by the field's
   * *technical* name (`headline`, not "Headline"). Visible labels are
   * translated and re-worded; the input id carries the schema key.
   */
  textField(fieldName: string): Locator {
    return this.page.locator(".sb-textfield").locator(`input[id*="${fieldName}"]`);
  }
}
