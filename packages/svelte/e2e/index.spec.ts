import { expect, test } from "@playwright/test";

test.describe("@storyblok/svelte", () => {
  test("renders the teaser block", async ({ page }) => {
    await page.goto("/");

    // `data-blok-c` comes from the block's `_editable` data, so this targets
    // the teaser itself without depending on its headline.
    const teaser = page.locator('article[data-blok-c*=\'"name":"teaser"\']').first();
    await expect(teaser).toHaveText(/\S+/);
  });
});
