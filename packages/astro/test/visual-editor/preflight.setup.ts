import { expect, test as setup } from "@playwright/test";
import { EXPECTED_SLUGS, QA_CONFIG } from "./config";

const SEED =
  "bash .agents/skills/qa-engineer-manual/scripts/seed-scenario.sh " +
  "--scenario has-playground-content --scenario-dir packages/astro/test/scenarios";

setup(
  "the playground serves the seeded space, not a stale or misconfigured one",
  async ({ request }) => {
    const response = await request.get(`${QA_CONFIG.previewBaseUrl}/home`);
    expect(
      response.status(),
      `${QA_CONFIG.previewBaseUrl} did not respond. Start it with: pnpm --filter @storyblok/astro qa:dev`,
    ).toBe(200);

    const body = await response.text();
    expect(
      body,
      `${QA_CONFIG.previewBaseUrl}/home did not contain the seeded marker "QA teaser headline". Likely ` +
        "causes: a background dev server left over from an earlier run serving stale code (stop it with " +
        "`pnpm --filter @storyblok/astro qa:stop`), STORYBLOK_ACCESS_TOKEN is not exported so the " +
        "playground fell back to the demo token committed in playground/ssr/astro.config.mjs, the space " +
        "is not seeded, or an earlier run's save and publish specs wrote over the seeded content. " +
        `Re-seed: ${SEED}`,
    ).toContain("QA teaser headline");
  },
);

setup("the space preview domain points at the playground", async ({ request }) => {
  const response = await request.get(`${QA_CONFIG.mapiBaseUrl}/spaces/${QA_CONFIG.spaceId}`, {
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
    `${QA_CONFIG.mapiBaseUrl}/spaces/${QA_CONFIG.spaceId}/stories?per_page=100`,
    { headers: { Authorization: QA_CONFIG.managementToken } },
  );
  expect(response.status(), "Could not list stories over MAPI").toBe(200);

  const { stories } = await response.json();
  const present = new Set(
    stories.map((story: { full_slug: string }) => story.full_slug.replace(/\/$/, "")),
  );
  const missing = EXPECTED_SLUGS.filter((slug) => !present.has(slug));

  expect(missing, `Missing seeded stories. Seed with: ${SEED}`).toEqual([]);
});

setup("the seeded relation field references the articles", async ({ request }) => {
  // The scenario seeds `featured-articles.posts` with the local story UUIDs and
  // the CLI remaps them to the remote ones on push. If that mapping regresses,
  // the relation spec fails on an empty list, which reads like a broken bridge.
  const list = await request.get(
    `${QA_CONFIG.mapiBaseUrl}/spaces/${QA_CONFIG.spaceId}/stories?per_page=100`,
    { headers: { Authorization: QA_CONFIG.managementToken } },
  );
  const { stories } = await list.json();
  const home = stories.find((entry: { full_slug: string }) => entry.full_slug === "home");
  const response = await request.get(
    `${QA_CONFIG.mapiBaseUrl}/spaces/${QA_CONFIG.spaceId}/stories/${home.id}`,
    { headers: { Authorization: QA_CONFIG.managementToken } },
  );
  expect(response.ok(), "Could not read the home story over MAPI").toBe(true);

  const { story } = await response.json();
  const block = (story.content.body ?? []).find(
    (entry: { component: string }) => entry.component === "featured-articles",
  );
  expect(block?.posts ?? [], `featured-articles has no references. Re-seed: ${SEED}`).toHaveLength(
    2,
  );
});
