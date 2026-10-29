import { expect, test } from "@playwright/test";

test.describe("@storyblok/svelte", () => {
  test("renders the teaser block", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("article").first()).toHaveText(/\S+/);
  });
});
