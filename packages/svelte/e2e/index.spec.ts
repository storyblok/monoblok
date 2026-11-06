import { expect, test } from "@playwright/test";

// The parameters `isInEditor` requires to treat a page as opened by the Visual Editor.
const EDITOR_QUERY = "?_storyblok=1&_storyblok_c=page&_storyblok_tk[space_id]=1";

test.describe("@storyblok/svelte", () => {
  test("should render the teaser block", async ({ page }) => {
    await page.goto("/");

    // `data-blok-c` comes from the block's `_editable` data, so this targets
    // the teaser itself without depending on its headline.
    const teaser = page.locator('article[data-blok-c*=\'"name":"teaser"\']').first();
    await expect(teaser).toHaveText(/\S+/);
  });

  test("should load the bridge when opened in the Visual Editor", async ({ page }) => {
    await page.goto(`/${EDITOR_QUERY}`);

    await expect
      .poll(() =>
        page.evaluate(() => typeof (window as { StoryblokBridge?: unknown }).StoryblokBridge),
      )
      .toBe("function");
  });

  test("should not load the bridge outside the Visual Editor", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    expect(
      await page.evaluate(() => typeof (window as { StoryblokBridge?: unknown }).StoryblokBridge),
    ).toBe("undefined");
  });

  test("should render nested blocks when a block component is imported before its registry", async ({
    page,
  }) => {
    const errors: Error[] = [];
    page.on("pageerror", (error) => errors.push(error));

    await page.goto("/import-cycle");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Rendered through the cycle")).toBeVisible();
    expect(errors).toEqual([]);
  });
});
