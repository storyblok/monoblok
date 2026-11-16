import { expect, test } from "@playwright/test";
import { runAstro, stopAstro, waitForServer, type AstroProcess } from "./playground-server";

/**
 * `<StoryblokPreview liveUpdate />`'s prerendered-route warning runs in the
 * Astro component's frontmatter, so it's logged by the dev server's own
 * process, not the browser the rest of this suite drives. This spec owns
 * its own dev server (rather than reusing the shared one on :4321) so it
 * can capture that output, pointed at `playground/test`: the same project
 * root the shared dev server already runs against. `--ignore-lock` lets
 * this second `astro dev` instance start alongside it instead of erroring.
 *
 * Only `liveUpdate` needs the warning — plain reload-on-save works fine on
 * a prerendered route.
 */
const PORT = 4325;
const BASE_URL = `http://localhost:${PORT}`;
const WARNING_TEXT = "is rendered on a prerendered route";

let server: AstroProcess;

test.describe("<StoryblokPreview /> prerendered-route warning", () => {
  test.beforeAll(async () => {
    server = runAstro(["dev", "--port", String(PORT), "--ignore-lock"]);
    await waitForServer(BASE_URL);
  });

  test.afterAll(() => {
    stopAstro(server);
  });

  test("warns on a prerendered route with liveUpdate", async ({ request }) => {
    server.clearOutput();
    const response = await request.get(`${BASE_URL}/prerendered-live-update-preview`);
    expect(response.ok()).toBe(true);

    await expect.poll(() => server.output()).toContain(WARNING_TEXT);
  });

  test("stays silent on a prerendered route without liveUpdate", async ({ request }) => {
    server.clearOutput();
    const response = await request.get(`${BASE_URL}/prerendered-preview`);
    expect(response.ok()).toBe(true);

    // No success signal to poll for here, so give the frontmatter a moment
    // to run before asserting its absence.
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(server.output()).not.toContain(WARNING_TEXT);
  });

  test("stays silent on an on-demand route", async ({ request }) => {
    server.clearOutput();
    const response = await request.get(`${BASE_URL}/on-demand-preview`);
    expect(response.ok()).toBe(true);

    // No success signal to poll for here, so give the frontmatter a moment
    // to run before asserting its absence.
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(server.output()).not.toContain(WARNING_TEXT);
  });
});
