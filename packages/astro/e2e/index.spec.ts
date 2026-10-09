import { expect, test } from "@playwright/test";

test.describe("@storyblok/astro", () => {
  test("storyblokEditable adds correct attributes", async ({ page }) => {
    await page.goto("/");
    const pageComponent = page.locator("[data-test=page-component]");
    await expect(pageComponent).toHaveAttribute(
      "data-blok-uid",
      "291636474-b0efb26b-f00a-455f-8862-4a6e650c1d4d",
    );
    await expect(pageComponent).toHaveAttribute(
      "data-blok-c",
      `{"name":"page","space":"221046","uid":"b0efb26b-f00a-455f-8862-4a6e650c1d4d","id":"291636474"}`,
    );
  });

  test("component registered via defineStoryblokBlocks is rendered correctly", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("[data-test=feature-component]").first()).toBeAttached();
  });

  test("the fallback passed to defineStoryblokBlocks is rendered for unregistered block types", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator("[data-test=custom-fallback-component]").first()).toBeAttached();
  });

  test("RichText Renderer renders embedded bloks correctly", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("[data-test=embedded-blok]").first()).toBeAttached();
  });
});
