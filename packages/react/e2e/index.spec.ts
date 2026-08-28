import { expect, test } from "@playwright/test";

test.describe("@storyblok/react", () => {
  test.describe("Bridge", () => {
    test("is loaded by default", async ({ page }) => {
      await page.goto(
        "/?_storyblok=1&_storyblok_c=1&_storyblok_tk[space_id]=12345&_storyblok_tk[timestamp]=1677494658",
      );
      await expect
        .poll(() =>
          page.evaluate(
            () => typeof (window as unknown as Record<string, unknown>).storyblokRegisterEvent,
          ),
        )
        .toBe("function");
      await expect
        .poll(() =>
          page.evaluate(
            () => typeof (window as unknown as Record<string, unknown>).StoryblokBridge,
          ),
        )
        .toBe("function");
    });
  });

  test.describe("Rendering Components", () => {
    test("renders teaser component", async ({ page }) => {
      await page.goto("/");
      await expect(page.locator('[data-test="teaser"]')).toBeVisible();
    });
  });
});
