import { existsSync } from "node:fs";
import { expect, test as setup } from "@playwright/test";
import type { QaConfig } from "./config";

const REGENERATE = "node .agents/skills/qa-engineer-manual/scripts/save-storyblok-session.mjs";

/** Registers the session check. Call it from the package's `auth.setup.ts`. */
export const registerAuthSetup = (config: QaConfig): void => {
  setup("a valid app session exists", async ({ page }) => {
    expect(
      existsSync(config.storageStatePath),
      `No saved session at ${config.storageStatePath}. Create one with: ${REGENERATE}`,
    ).toBe(true);

    // A saved-but-expired session redirects to the login screen. Assert we
    // reached the app, not that no error was thrown.
    await page.goto(`${config.appBaseUrl}/#/me/spaces/${config.spaceId}/stories`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page, `Session expired. Refresh it with: ${REGENERATE}`).not.toHaveURL(
      /#!?\/login/,
    );
  });
};

/**
 * Registers the setup checks that separate a broken environment from a broken
 * bridge. Call it from the package's `preflight.setup.ts`.
 */
export const registerPreflightSetup = (config: QaConfig): void => {
  setup(
    "the playground serves the seeded space, not a stale or misconfigured one",
    async ({ request }) => {
      const response = await request.get(`${config.previewBaseUrl}${config.previewPath}`);
      expect(
        response.status(),
        `${config.previewBaseUrl} did not respond. Start it with: pnpm --filter ${config.packageName} qa:dev`,
      ).toBe(200);

      // A status check alone looks green while the content is wrong, so assert
      // the seeded marker: that is what tells the three causes below apart.
      expect(
        await response.text(),
        `${config.previewBaseUrl}${config.previewPath} did not contain the seeded marker ` +
          `"${config.seededMarker}". Likely causes: a dev server left over from an earlier run is ` +
          `serving stale code, ${config.accessTokenEnvVar} is not exported so the playground fell ` +
          "back to the demo token committed in its config, the space is not seeded, or an earlier " +
          `run's save and publish specs wrote over the seeded content. Re-seed: ${config.seedCommand}`,
      ).toContain(config.seededMarker);
    },
  );

  setup("the space preview domain points at the playground", async ({ request }) => {
    const response = await request.get(`${config.mapiBaseUrl}/spaces/${config.spaceId}`, {
      headers: { Authorization: config.managementToken },
    });
    expect(response.status(), "Could not read the space over MAPI").toBe(200);

    const { space } = await response.json();
    expect(
      space.domain?.replace(/\/$/, ""),
      `Space ${config.spaceId} previews "${space.domain}". Point it at the playground with: ` +
        "bash .agents/skills/qa-engineer-manual/scripts/configure-space.sh " +
        `--domain ${config.previewBaseUrl}/ --confirm`,
    ).toBe(config.previewBaseUrl.replace(/\/$/, ""));
  });

  setup("the space is seeded", async ({ request }) => {
    const response = await request.get(
      `${config.mapiBaseUrl}/spaces/${config.spaceId}/stories?per_page=100`,
      { headers: { Authorization: config.managementToken } },
    );
    expect(response.status(), "Could not list stories over MAPI").toBe(200);

    const { stories } = await response.json();
    // A folder start page's full_slug carries a trailing slash ("vue/").
    const present = new Set(
      stories.map((story: { full_slug: string }) => story.full_slug.replace(/\/$/, "")),
    );
    const missing = config.expectedSlugs.filter((slug) => !present.has(slug));

    expect(missing, `Missing seeded stories. Seed with: ${config.seedCommand}`).toEqual([]);
  });

  setup("the seeded relation field references its targets", async ({ request }) => {
    // The scenario seeds the relation with the local story UUIDs and the CLI
    // remaps them to the remote ones on push. If that mapping regresses, the
    // relation spec fails on an empty list, which reads like a broken bridge.
    const { relation } = config;
    const list = await request.get(
      `${config.mapiBaseUrl}/spaces/${config.spaceId}/stories?per_page=100`,
      { headers: { Authorization: config.managementToken } },
    );
    const { stories } = await list.json();
    const owner = stories.find(
      (entry: { full_slug: string }) =>
        entry.full_slug.replace(/\/$/, "") === relation.storySlug.replace(/\/$/, ""),
    );
    expect(
      owner,
      `Story "${relation.storySlug}" is missing. Seed with: ${config.seedCommand}`,
    ).toBeDefined();

    const response = await request.get(
      `${config.mapiBaseUrl}/spaces/${config.spaceId}/stories/${owner.id}`,
      { headers: { Authorization: config.managementToken } },
    );
    expect(response.ok(), `Could not read "${relation.storySlug}" over MAPI`).toBe(true);

    const { story } = await response.json();
    const block = (story.content.body ?? []).find(
      (entry: { component: string }) => entry.component === relation.component,
    );
    expect(
      block?.[relation.field] ?? [],
      `${relation.component}.${relation.field} has no references. Re-seed: ${config.seedCommand}`,
    ).toHaveLength(relation.count);
  });
};
