import { expect, test } from "@playwright/test";

test.describe("@storyblok/svelte", () => {
  test("renders the teaser block", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.locator('article[data-blok-uid^="141210018-"]').filter({ hasText: "First Teaser" }),
    ).toBeVisible();
  });
});
