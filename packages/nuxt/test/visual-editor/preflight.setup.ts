import { expect, test as setup } from "@playwright/test";
import { EXPECTED_SLUGS, QA_CONFIG } from "./config";

setup("the playground serves trusted https", async ({ request }) => {
  const response = await request.get(`${QA_CONFIG.previewBaseUrl}/`);
  expect(
    response.status(),
    `${QA_CONFIG.previewBaseUrl} did not respond. Start it with: pnpm --filter @storyblok/nuxt qa:dev`,
  ).toBe(200);
});

setup("the space preview domain points at the playground", async ({ request }) => {
  const response = await request.get(`https://mapi.storyblok.com/v1/spaces/${QA_CONFIG.spaceId}`, {
    headers: { Authorization: QA_CONFIG.managementToken },
  });
  expect(response.status(), "Could not read the space over MAPI").toBe(200);

  const { space } = await response.json();
  expect(
    space.domain?.replace(/\/$/, ""),
    `Space ${QA_CONFIG.spaceId} previews "${space.domain}". Point it at the playground with: ` +
      `bash .agents/skills/qa-engineer-manual/scripts/configure-space.sh --domain ${QA_CONFIG.previewBaseUrl}/ --confirm`,
  ).toBe(QA_CONFIG.previewBaseUrl.replace(/\/$/, ""));
});

setup("the space is seeded", async ({ request }) => {
  const response = await request.get(
    `https://mapi.storyblok.com/v1/spaces/${QA_CONFIG.spaceId}/stories?per_page=100`,
    { headers: { Authorization: QA_CONFIG.managementToken } },
  );
  expect(response.status(), "Could not list stories over MAPI").toBe(200);

  const { stories } = await response.json();
  // A folder start page's full_slug carries a trailing slash ("vue/").
  const present = new Set(
    stories.map((story: { full_slug: string }) => story.full_slug.replace(/\/$/, "")),
  );
  const missing = EXPECTED_SLUGS.filter((slug) => !present.has(slug));

  expect(
    missing,
    "Missing seeded stories. Seed with: bash .agents/skills/qa-engineer-manual/scripts/seed-scenario.sh " +
      "--scenario has-playground-content --scenario-dir packages/nuxt/test/scenarios",
  ).toEqual([]);
});
