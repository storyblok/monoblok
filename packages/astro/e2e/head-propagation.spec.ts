import { expect, test, type Page } from "@playwright/test";
import { runAstro, stopAstro, waitForServer, type AstroProcess } from "./playground-server";

/**
 * A block that renders an MDX content entry, which embeds a component with a
 * scoped `<style>`. Astro hoists that style into `<head>` through head
 * propagation, which only works if every component between the page and the
 * entry is flagged as propagating. A block resolved from the registry is
 * reached through props, which Astro's own import-graph analysis can't see:
 * the markup still renders, only the style goes missing.
 *
 * `direct` imports the block itself and is the control; the other pages
 * render it through `@storyblok/astro`. Runs against both the dev server and
 * a production build (built by `global-setup.ts`), which take different code
 * paths for head content.
 */
const PAGES = [
  ["imported directly", "/head-propagation/direct"],
  ["rendered by StoryblokBlock", "/head-propagation/block"],
  ["nested in another registry block", "/head-propagation/nested-block"],
  ["embedded in StoryblokRichText", "/head-propagation/rich-text"],
  ["nested in a StoryblokRichText node", "/head-propagation/rich-text-nested"],
] as const;

const PREVIEW_PORT = 4326;
const PREVIEW_URL = `http://localhost:${PREVIEW_PORT}`;

async function expectStyledCallout(page: Page, url: string): Promise<void> {
  await page.goto(url);
  const callout = page.locator("[data-test=callout]");
  await expect(callout).toBeAttached();
  // `Callout.astro` scopes `color: rgb(255, 0, 0)` to itself.
  await expect(callout).toHaveCSS("color", "rgb(255, 0, 0)");
}

test.describe("head propagation through the block registry (dev)", () => {
  for (const [name, path] of PAGES) {
    test(`applies a block's MDX styles when ${name}`, async ({ page }) => {
      await expectStyledCallout(page, path);
    });
  }
});

test.describe("head propagation through the block registry (production build)", () => {
  let preview: AstroProcess | undefined;

  test.beforeAll(async () => {
    preview = runAstro(["preview", "--port", String(PREVIEW_PORT)]);
    await waitForServer(PREVIEW_URL);
  });

  test.afterAll(() => {
    stopAstro(preview);
  });

  for (const [name, path] of PAGES) {
    test(`applies a block's MDX styles when ${name}`, async ({ page }) => {
      await expectStyledCallout(page, `${PREVIEW_URL}${path}`);
    });
  }
});
