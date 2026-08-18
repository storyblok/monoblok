import { expect, test } from "@playwright/test";
import { QA_CONFIG } from "../config";

test("server.vue renders the server-fetched story", async ({ page }) => {
  // Expected to fail: the playground does not set `enableServerClient: true`, so
  // `serverStoryblokClient` has no access token and /api/test returns
  // { success: false }. Report this as a finding; do not "fix" the playground.
  test.fail();
  await page.goto(`${QA_CONFIG.previewBaseUrl}/server`);

  await expect(page.getByText("Loading...")).toHaveCount(0);
  await expect(page.locator('[data-test="page"], [data-test="teaser"]').first()).toBeVisible();
});

test("the /api/test route reports why the server client is unavailable", async ({ request }) => {
  const response = await request.get(`${QA_CONFIG.previewBaseUrl}/api/test`);
  const body = await response.json();

  // Asserts the observed state, so the day the module is fixed this test fails
  // and someone deletes it along with the test.fail() above.
  expect(body.success).toBe(false);
  expect(body.error).toContain("access token is not configured");
});
