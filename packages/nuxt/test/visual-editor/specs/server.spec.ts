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

test("the /api/test route fails before it can report a useful reason", async ({ request }) => {
  const response = await request.get(`${QA_CONFIG.previewBaseUrl}/api/test`);
  const body = await response.json();

  // Asserts the OBSERVED failure, which is worse than the module intends.
  // `serverStoryblokClient` destructures `config.storyblok` before checking the
  // token, so with `enableServerClient` unset that key is undefined and the
  // destructure throws — the module's own "access token is not configured"
  // message is unreachable. The playground route also calls the helper outside
  // its try/catch, so the request 500s instead of returning { success: false }.
  // The day either is fixed, this test fails and should be rewritten.
  expect(response.status()).toBe(500);
  expect(body.message).toContain("config.storyblok");
});
