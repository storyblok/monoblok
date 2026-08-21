import type { Browser } from "playwright";

import type { Playground } from "./config.ts";

export type SmokeResult = {
  ok: boolean;
  status?: number;
  problems: string[];
  /** Whatever the page exposed on `window.__demo`, for fixtures that report. */
  probe?: unknown;
};

/**
 * Drives a real browser against the running container.
 *
 * The browser lives on the host (or on a remote Playwright server), never in
 * the image: the container is meant to look like a consumer's production
 * machine, and a consumer's production machine does not have Chromium on it.
 */
export async function smokeTest(options: {
  browser: Browser;
  url: string;
  playground: Playground;
}): Promise<SmokeResult> {
  const { browser, url, playground } = options;
  const problems: string[] = [];
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  let status: number | undefined;
  let probe: unknown;

  try {
    const response = await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
    status = response?.status();

    if (!response || !response.ok()) {
      problems.push(`HTTP ${status ?? "no response"} for ${url}`);
    }

    const bodyText = (
      await page
        .locator("body")
        .innerText()
        .catch(() => "")
    ).trim();
    if (bodyText.length < 20) {
      problems.push(`page rendered almost nothing (${bodyText.length} characters of text)`);
    }

    probe = await page
      .evaluate(() => (window as unknown as { __demo?: unknown }).__demo)
      .catch(() => undefined);

    for (const text of playground.smoke?.expectText ?? []) {
      if (!bodyText.includes(text)) problems.push(`expected text "${text}" is missing`);
    }

    for (const selector of playground.smoke?.expectSelector ?? []) {
      if ((await page.locator(selector).count()) === 0) {
        problems.push(`expected selector "${selector}" is missing`);
      }
    }

    // A bare specifier that survived into a browser bundle shows up here and
    // nowhere else: the build is green and the page is blank.
    const resolutionErrors = [...consoleErrors, ...pageErrors].filter((message) =>
      /Failed to resolve module|Cannot find module|Failed to fetch dynamically imported module|is not a function|Unexpected token/i.test(
        message,
      ),
    );

    if (resolutionErrors.length > 0) {
      problems.push(`module resolution failed at runtime: ${resolutionErrors.join(" | ")}`);
    } else if (playground.smoke?.allowConsoleErrors === false) {
      for (const message of [...pageErrors, ...consoleErrors]) {
        problems.push(`console/page error: ${message}`);
      }
    }
  } catch (error) {
    problems.push(`navigation failed: ${(error as Error).message}`);
  } finally {
    await context.close();
  }

  return { ok: problems.length === 0, status, problems, probe };
}

export async function launchBrowser(): Promise<Browser> {
  const { chromium } = await import("playwright");
  const remote = process.env.MATRIX_PLAYWRIGHT_WS;

  if (remote) return chromium.connect(remote);
  return chromium.launch();
}
