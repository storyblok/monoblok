// Drives the real Visual Editor with Playwright, so a save made by the editor
// itself can be read back through the Management API and diffed. Nothing we
// author ourselves can stand in for this: the question is what the editor
// writes that we would not have written.
//
// Reuses the login saved by the QA session helper; it never reads a credential.
//
//   OUT=<dir> STORY_ID=<id> SPACE_ID=<id> MODE=noop|edit \
//   INPUT_ID=<field input id> NEW_VALUE=<text> node scripts/drive-visual-editor.mjs
import { chromium } from "@playwright/test";

const OUT = process.env.OUT ?? ".";
const SPACE = process.env.SPACE_ID;
const STORY = process.env.STORY_ID;
const MODE = process.env.MODE ?? "noop"; // noop | edit
const BLOCK_LABEL = process.env.BLOCK_LABEL ?? "spike_meta";
const NEW_VALUE = process.env.NEW_VALUE ?? "Top EDITED";
const TAG = process.env.TAG ?? MODE;

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  storageState: ".storyblok-qa/session.json",
  viewport: { width: 1600, height: 1000 },
});
const page = await ctx.newPage();

const saveRequests = [];
page.on("request", (req) => {
  const u = req.url();
  if (/\/stories\//.test(u) && ["PUT", "POST"].includes(req.method())) {
    saveRequests.push({ method: req.method(), url: u, body: req.postData() });
  }
});
const saveResponses = [];
page.on("response", async (res) => {
  const u = res.url();
  if (/\/stories\//.test(u) && ["PUT", "POST"].includes(res.request().method())) {
    let body = null;
    try {
      body = await res.text();
    } catch {}
    saveResponses.push({ status: res.status(), url: u, body });
  }
});

await page.goto(`https://app.storyblok.com/#/me/spaces/${SPACE}/stories/0/0/${STORY}`, {
  waitUntil: "domcontentloaded",
});
await page.waitForTimeout(15000);

if (MODE === "edit") {
  await page.getByText(BLOCK_LABEL, { exact: true }).last().click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/ve-${TAG}-block.png` });
  console.log(
    "inputs:",
    await page
      .locator("input[type=text]")
      .evaluateAll((els) => els.map((e) => ({ id: e.id, value: e.value }))),
  );
  const input = process.env.INPUT_ID
    ? page.locator(`[id="${process.env.INPUT_ID}"]`)
    : page.locator("input[type=text]").last();
  await input.click();
  await input.fill(NEW_VALUE);
  await page.keyboard.press("Tab");
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/ve-${TAG}-filled.png` });
}

await page.getByRole("button", { name: "Save", exact: true }).click();
await page.waitForTimeout(8000);
await page.screenshot({ path: `${OUT}/ve-${TAG}-saved.png` });
console.log(
  JSON.stringify({ saveRequests: saveRequests.map((r) => ({ m: r.method, u: r.url })) }, null, 2),
);
const { writeFileSync } = await import("node:fs");
writeFileSync(
  `${OUT}/ve-${TAG}-net.json`,
  JSON.stringify({ saveRequests, saveResponses }, null, 2),
);
console.log("responses:", saveResponses.map((r) => `${r.status} ${r.url}`).join("\n"));
await ctx.storageState({ path: ".storyblok-qa/session.json" });
await browser.close();
