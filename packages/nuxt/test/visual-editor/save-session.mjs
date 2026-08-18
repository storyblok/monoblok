// Opens a headed browser so a human can log in to Storyblok once, 2FA and all,
// then saves the session for the Playwright harness to reuse. No credential is
// read, stored, or transmitted by this script.
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { chromium } from "@playwright/test";

const appBaseUrl = process.env.STORYBLOK_APP_URL ?? "https://app.storyblok.com";

const statePath = resolve(import.meta.dirname, ".auth/storyblok.json");
mkdirSync(dirname(statePath), { recursive: true });

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page = await context.newPage();
await page.goto(`${appBaseUrl}/#!/me/spaces`);

console.log("\nLog in in the browser window, then press Enter here to save the session.");
const rl = createInterface({ input: process.stdin, output: process.stdout });
await rl.question("");
rl.close();

await context.storageState({ path: statePath });
await browser.close();
console.log(`Saved session to ${statePath}`);
