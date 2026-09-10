// Opens a headed browser so a human can log in to app.storyblok.com once, 2FA
// and all, then saves the session for Playwright to reuse. No credential is
// read, stored, or transmitted by this script, only the resulting session
// state, which is gitignored.
//
// The state is written to <repo root>/.storyblok-qa/session.json, so every
// package harness and every one-off script in .claude/tmp/ reuses one login.
//
// Completion is detected from the BROWSER, not from the terminal: the script
// polls for a session credential and a URL that is no longer the login screen.
// That means an agent can start this while a person only interacts with the
// browser window; a terminal prompt would need a TTY the agent does not have.
//
// Usage:
//   node .agents/skills/qa-engineer-manual/scripts/save-storyblok-session.mjs
//
// STORYBLOK_QA_CDP_URL drives a Chrome that is already running with remote
// debugging instead of launching one, for environments with no display.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { chromium } from "@playwright/test";

const appBaseUrl = process.env.STORYBLOK_APP_URL ?? "https://app.storyblok.com";
const cdpUrl = process.env.STORYBLOK_QA_CDP_URL;
const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const statePath = process.env.STORYBLOK_QA_SESSION ?? join(repoRoot, ".storyblok-qa/session.json");
const TIMEOUT_MS = 15 * 60 * 1000;
const POLL_MS = 2000;
const SESSION_KEY = /session|auth|token/i;

mkdirSync(dirname(statePath), { recursive: true });

const browser = cdpUrl
  ? await chromium.connectOverCDP(cdpUrl)
  : await chromium.launch({ headless: false });
const context = browser.contexts()[0] ?? (await browser.newContext());
const appOrigin = new URL(appBaseUrl).origin;
const openAppPage = context.pages().find((candidate) => {
  try {
    return new URL(candidate.url()).origin === appOrigin;
  } catch {
    return false;
  }
});
const page = openAppPage ?? (await context.newPage());
if (!openAppPage) await page.goto(`${appBaseUrl}/#/me/spaces`);

console.log(`Browser open. Log in at ${appBaseUrl}; the session saves by itself.`);

// The app holds its credential in localStorage rather than in a cookie, and
// storageState() reports no origins at all over a CDP connection, so the login
// is both detected and saved by reading the page itself.
const readLocalStorage = async () => {
  const entries = await page
    .evaluate(() => Object.entries(localStorage).map(([name, value]) => ({ name, value })))
    .catch(() => []);
  return entries.length ? [{ origin: appOrigin, localStorage: entries }] : [];
};

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
  const origins = await readLocalStorage();
  const hasSession =
    cookies.some((cookie) => SESSION_KEY.test(cookie.name)) ||
    origins.some((origin) => origin.localStorage.some((item) => SESSION_KEY.test(item.name)));
  const onLoginScreen = /login|sign_?in/i.test(url);

  if (hasSession && !onLoginScreen) {
    // Let the app finish writing anything else it sets on first render.
    await new Promise((r) => setTimeout(r, POLL_MS));
    const state = await context.storageState();
    const origins = state.origins.length ? state.origins : await readLocalStorage();
    writeFileSync(statePath, JSON.stringify({ ...state, origins }, null, 2));
    saved = true;
    console.log(JSON.stringify({ outcome: "PASS", details: `session saved to ${statePath}` }));
    break;
  }
}

if (!saved) {
  console.log(JSON.stringify({ outcome: "FAIL", details: "timed out waiting for login" }));
}

// Over CDP this only disconnects; the window belongs to whoever started it.
await browser.close().catch(() => {});
process.exit(saved ? 0 : 1);
