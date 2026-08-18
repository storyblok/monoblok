// Opens a headed browser so a human can log in to Storyblok once, 2FA and all,
// then saves the session for the Playwright harness to reuse. No credential is
// read, stored, or transmitted by this script.
//
// Completion is detected from the BROWSER, not from the terminal: the script
// polls for a session cookie and a URL that is no longer the login screen. That
// means an agent can start this while a person only interacts with the browser
// window — a terminal prompt would need a TTY the agent does not have.
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { chromium } from "@playwright/test";

const appBaseUrl = process.env.STORYBLOK_APP_URL ?? "https://app.storyblok.com";
const statePath = resolve(import.meta.dirname, ".auth/storyblok.json");
const TIMEOUT_MS = 15 * 60 * 1000;
const POLL_MS = 2000;

mkdirSync(dirname(statePath), { recursive: true });

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page = await context.newPage();
await page.goto(`${appBaseUrl}/#/me/spaces`);

console.log(`Browser open. Log in at ${appBaseUrl}; the session saves by itself.`);

const startedAt = Date.now();
let saved = false;

while (Date.now() - startedAt < TIMEOUT_MS) {
  await new Promise((r) => setTimeout(r, POLL_MS));

  let url;
  try {
    url = page.url();
  } catch {
    console.log(
      JSON.stringify({ outcome: "FAIL", details: "browser closed before login completed" }),
    );
    break;
  }

  const cookies = await context.cookies();
  const hasSession = cookies.some((cookie) => /session|auth|token/i.test(cookie.name));
  const onLoginScreen = /login|sign_?in/i.test(url);

  if (hasSession && !onLoginScreen) {
    // Let the app finish writing anything else it sets on first render.
    await new Promise((r) => setTimeout(r, POLL_MS));
    await context.storageState({ path: statePath });
    saved = true;
    console.log(JSON.stringify({ outcome: "PASS", details: `session saved to ${statePath}` }));
    break;
  }
}

if (!saved) {
  console.log(JSON.stringify({ outcome: "FAIL", details: "timed out waiting for login" }));
}

await browser.close().catch(() => {});
process.exit(saved ? 0 : 1);
