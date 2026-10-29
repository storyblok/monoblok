import { expect, test } from "@playwright/test";

test.describe("@storyblok/svelte", () => {
  test("loads the Storyblok bridge by default", async ({ page }) => {
    await page.goto(
      "/?_storyblok=1&_storyblok_c=1&_storyblok_tk[space_id]=147897&_storyblok_tk[timestamp]=1677494658",
    );

    await expect
      .poll(() => page.evaluate(() => typeof window.storyblokRegisterEvent))
      .toBe("function");
    await expect.poll(() => page.evaluate(() => typeof window.StoryblokBridge)).toBe("function");
  });

  test("renders the teaser block", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.locator('article[data-blok-uid^="141210018-"]').filter({ hasText: "First Teaser" }),
    ).toBeVisible();
  });
});
