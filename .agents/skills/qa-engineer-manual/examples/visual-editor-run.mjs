// A starting point for a one-off Visual Editor check. Copy it to .claude/tmp/,
// make it your own, run it, throw it away:
//
//   node .agents/skills/qa-engineer-manual/scripts/save-storyblok-session.mjs  # once
//   set -a && source ./.env.qa-engineer-manual && set +a
//   node .claude/tmp/my-check.mjs
//
// As written it opens a story in the editor, selects a block, types into one of
// its fields, and asserts the preview changed. Adapt it to whatever you are
// actually checking: the CONSTANTS block covers a different story, app, block, or
// field, and past that, edit the body. Assert the thing your feature does, be it
// a relation that stays resolved, a block that keeps its state through an update,
// or a save that reloads the preview.
//
// Whatever you assert, assert an observed change. A broken bridge throws nothing,
// so "no error" proves nothing, and after a save or publish the live-updating
// preview already shows the new text: there, count preview-frame navigations and
// confirm the space over MAPI or CAPI.
//
// The selectors below are duplicated from tools/visual-editor-qa/src/
// editor.page.ts, which is the maintained copy shared by every package's
// harness. Check there first when a Storyblok release breaks this.
//
// Blocks are addressed by the `_uid` the scenario seeded: storyblokEditable
// emits data-blok-uid="<storyId>-<uid>" on every editable block, so this needs
// nothing added to the app's components.
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { chromium, expect } from "@playwright/test";

// --- CONSTANTS: edit these ------------------------------------------------
const FULL_SLUG = "vue"; // the story to open
const PREVIEW_URL = "https://localhost:3200"; // where the local app is served
const BLOCK = "teaser-start-1"; // the block's seeded `_uid`
const FIELD = "headline"; // the block field's *technical* name
const NEW_VALUE = "edited by a one-off check";
// -------------------------------------------------------------------------

const appBaseUrl = process.env.STORYBLOK_APP_URL ?? "https://app.storyblok.com";
const mapiBaseUrl = process.env.STORYBLOK_MAPI_URL ?? "https://mapi.storyblok.com/v1";
const spaceId = process.env.STORYBLOK_SPACE_ID;
const token = process.env.STORYBLOK_TOKEN;
const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const storageState =
  process.env.STORYBLOK_QA_SESSION ?? join(repoRoot, ".storyblok-qa/session.json");

const fail = (details) => {
  console.log(JSON.stringify({ outcome: "FAIL", details }));
  process.exit(1);
};

if (!spaceId || !token) {
  fail("Missing STORYBLOK_SPACE_ID or STORYBLOK_TOKEN. Export them from .env.qa-engineer-manual.");
}

// The editor URL keys on the story's numeric id, not its slug.
const response = await fetch(`${mapiBaseUrl}/spaces/${spaceId}/stories?per_page=100`, {
  headers: { Authorization: token },
});
const { stories } = await response.json();
const story = stories.find((entry) => entry.full_slug.replace(/\/$/, "") === FULL_SLUG);
if (!story) {
  fail(`Story "${FULL_SLUG}" is not in space ${spaceId}. Seed it first.`);
}

// Live preview morphs new text in before you save, so after a save/publish
// "the preview shows the new text" is already true when the reload path is
// dead. Count navigations of the preview frame and assert the count rose.
let previewLoads = 0;

const browser = await chromium.launch({
  // The editor is served from a public origin and embeds the app from
  // localhost. Chrome's Local Network Access policy blocks that iframe and
  // renders a chrome-error page instead, indistinguishable from a dead bridge.
  args: ["--disable-features=LocalNetworkAccessChecks,BlockInsecurePrivateNetworkRequests"],
});
// ignoreHTTPSErrors covers the preview iframe's self-signed certificate too.
const context = await browser.newContext({ storageState, ignoreHTTPSErrors: true });
const page = await context.newPage();
page.on("framenavigated", (frame) => {
  if (frame.url().startsWith(PREVIEW_URL)) {
    previewLoads++;
  }
});

try {
  // Link 1 of the chain: the app serves the story standalone. When this fails,
  // the seed or the access token is wrong, not the bridge.
  await page.goto(`${PREVIEW_URL}/${FULL_SLUG}`);
  await expect(page.locator(`[data-blok-uid$="-${BLOCK}"]`).first()).toBeVisible({
    timeout: 30_000,
  });

  await page.goto(`${appBaseUrl}/#/me/spaces/${spaceId}/stories/0/0/${story.id}`, {
    waitUntil: "domcontentloaded",
  });
  // If you open a second story later in the same tab, the URL differs only in
  // its hash: the app swaps the form and the iframe keeps the previous story.
  // Force a page.reload() there, or every assertion times out on the wrong page.
  // Assert the editor itself loaded, so a later preview failure cannot be
  // confused with the app never rendering.
  await expect(page.getByTestId("editor-form")).toBeVisible({ timeout: 60_000 });

  const preview = page.frameLocator("#storyblok-preview");
  const block = preview.locator(`[data-blok-uid$="-${BLOCK}"]`).first();
  await expect(block).toBeVisible({ timeout: 60_000 });

  // The input id encodes the owning block (`<storyId>__<field>-<blokUid>`).
  // The story-level form carries fields with the same technical names, so
  // asserting the field is merely visible proves nothing: a click that failed
  // to switch forms then edits the story field, which the app may not render.
  const field = page.locator(".sb-textfield").locator(`input[id*="${FIELD}"]`);
  const idBefore = (await field.count()) > 0 ? await field.getAttribute("id") : null;

  // The bridge's click handler is not ready the instant the preview paints, so
  // the first click is sometimes swallowed. Retry rather than sleep.
  for (let attempt = 1; attempt <= 3; attempt++) {
    await block.click();
    try {
      await expect
        .poll(async () => ((await field.count()) > 0 ? field.getAttribute("id") : null), {
          timeout: 5000,
        })
        .not.toBe(idBefore);
      break;
    } catch (error) {
      if (attempt === 3) {
        throw error;
      }
    }
  }

  await field.fill(NEW_VALUE);
  // The one assertion that matters: the preview changed, before any save.
  await expect(block).toContainText(NEW_VALUE, { timeout: 30_000 });

  console.log(
    JSON.stringify({
      outcome: "PASS",
      function: "live-update",
      details: `${FULL_SLUG} > ${BLOCK}, preview loads: ${previewLoads}`,
    }),
  );
} catch (error) {
  // Name the link that broke: a bare timeout is indistinguishable between the
  // editor not loading, the iframe being blocked, and a dead bridge.
  console.log(
    JSON.stringify({
      outcome: "FAIL",
      details: `${error.message} | preview frame URL: ${page
        .frames()
        .map((f) => f.url())
        .join(", ")}`,
    }),
  );
  process.exitCode = 1;
} finally {
  await browser.close().catch(() => {});
}
