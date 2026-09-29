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

    // Proves recursive `StoryblokBlock` resolution (grid → feature)
    // survives a real bundler and browser, not just jsdom.
    test("renders a nested grid of feature blocks", async ({ page }) => {
      await page.goto("/");
      await expect(page.locator('[data-test="grid"]')).toBeVisible();
      await expect(page.locator('[data-test="feature"]')).toHaveCount(3);
    });

    test("shows a not-found state for an unknown slug instead of crashing", async ({ page }) => {
      const response = await page.goto("/this-slug-does-not-exist-e2e-test");
      expect(response?.ok()).toBe(true);
      await expect(page.getByText(/story not found/i)).toBeVisible();
    });
  });

  test.describe("Richtext rendering", () => {
    // Exercises headings, marks, lists, blockquotes, and tables from a real
    // richtext document through the built package, in a real browser.
    test("renders headings, marks, lists, blockquotes, and tables", async ({ page }) => {
      await page.goto("/react/richtext");

      await expect(page.locator("h1")).toContainText("Headline 1");
      await expect(page.locator("h6")).toContainText("Headline 6");

      await expect(page.locator("strong", { hasText: "bold" }).first()).toBeVisible();
      await expect(page.locator("em", { hasText: "italic" }).first()).toBeVisible();

      await expect(page.locator("ul li", { hasText: "unordered list item" })).toBeVisible();
      await expect(page.locator("ol li", { hasText: "Enjoy" })).toBeVisible();

      await expect(page.locator("blockquote")).toContainText("I'm a quote");

      const table = page.locator("table");
      await expect(table).toBeVisible();
      await expect(table).toContainText("Header 1");
    });
  });
});
