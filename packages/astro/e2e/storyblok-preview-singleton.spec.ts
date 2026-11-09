import { expect, test } from "@playwright/test";

test.describe("<StoryblokPreview /> singleton guard", () => {
  test("throws when a second instance is mounted on the same page", async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (error) => pageErrors.push(error));

    await page.goto("/duplicate-preview");
    await expect
      .poll(() => pageErrors.some((error) => error.message.includes("More than one")))
      .toBe(true);
  });

  test("does not throw with a single instance", async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (error) => pageErrors.push(error));

    await page.goto("/on-demand-preview");
    // No success signal to poll for here, so give the custom element a
    // moment to upgrade before asserting the absence of an error.
    await page.waitForTimeout(500);

    expect(pageErrors).toHaveLength(0);
  });
});

test.describe("<StoryblokPreview liveUpdate /> morph-chunk gating", () => {
  // Matched on `/preview-handler` right after a path separator: a plain
  // `.includes("preview-handler")` also matches `@storyblok/live-preview`'s
  // own `create-live-preview-handler.mjs` (served unbundled in dev), which
  // has nothing to do with whether *this package's* morph chunk loaded.
  const PREVIEW_HANDLER_CHUNK = /\/preview-handler[.-]/;

  test("is not fetched for a plain visitor", async ({ page }) => {
    const requestUrls: string[] = [];
    page.on("request", (request) => requestUrls.push(request.url()));

    await page.goto("/live-update-preview");
    await page.waitForTimeout(500);

    expect(requestUrls.some((url) => PREVIEW_HANDLER_CHUNK.test(url))).toBe(false);
  });

  test("is fetched when Visual Editor query params are present", async ({ page }) => {
    const requestUrls: string[] = [];
    page.on("request", (request) => requestUrls.push(request.url()));

    await page.goto(
      "/live-update-preview?_storyblok=1&_storyblok_c=1&_storyblok_tk%5Bspace_id%5D=1",
    );
    await expect.poll(() => requestUrls.some((url) => PREVIEW_HANDLER_CHUNK.test(url))).toBe(true);
  });
});
