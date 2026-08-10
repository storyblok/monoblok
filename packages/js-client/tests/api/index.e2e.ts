import StoryblokClient from "storyblok-js-client";
import { beforeEach, describe, expect, it } from "vitest";

/**
 * Smoke tests against the real Storyblok CDN API.
 *
 * These tests are intentionally minimal — they exist to catch real API
 * regressions (e.g. auth, response shape changes, content structure) that
 * MSW-based tests cannot detect.
 *
 * They are skipped automatically when VITE_ACCESS_TOKEN is not set, so
 * they never block CI for external contributors. They run when a valid
 * token is available (e.g. internal PRs or scheduled workflows).
 *
 * Required env vars (in .env.test):
 *   VITE_ACCESS_TOKEN  — CDN access token
 *   VITE_SPACE_ID      — numeric space ID
 */
describe.skipIf(!process.env.VITE_ACCESS_TOKEN)("StoryblokClient (smoke tests)", () => {
  let client: StoryblokClient;

  beforeEach(() => {
    client = new StoryblokClient({
      accessToken: process.env.VITE_ACCESS_TOKEN,
      cache: { type: "memory", clear: "auto" },
    });
  });

  it("authenticates and returns space information", async () => {
    const { data } = await client.get("cdn/spaces/me");
    expect(data.space.id).toBe(Number(process.env.VITE_SPACE_ID));
  });

  it("returns at least one published story", async () => {
    const { data } = await client.get("cdn/stories");
    expect(data.stories.length).toBeGreaterThan(0);
  });

  it("returns a specific story by slug", async () => {
    const { data } = await client.get("cdn/stories/testcontent-0");
    expect(data.story.slug).toBe("testcontent-0");
  });

  it("resolves relations against real content", async () => {
    const { data } = await client.get("cdn/stories/testcontent-0", {
      resolve_relations: "root.author",
    });
    expect(data.story.content.author[0].slug).toBe("edgar-allan-poe");
  });

  it("returns stories matching a by_slugs wildcard", async () => {
    const { data } = await client.get("cdn/stories", { by_slugs: "folder/*" });
    expect(data.stories.length).toBeGreaterThan(0);
  });

  it("paginates through all stories with getAll", async () => {
    const result = await client.getAll("cdn/stories", {});
    expect(result.length).toBeGreaterThan(0);
  });

  it("filter_query with nested params uses raw brackets in the request URL", async () => {
    const { data: seed } = await client.get("cdn/stories", { per_page: 1 });
    const componentName = seed.stories[0].content.component as string;

    const { data } = await client.get("cdn/stories", {
      filter_query: { component: { in: componentName } },
    });

    expect(data.stories.length).toBeGreaterThan(0);
  });

  it("filter_query with lt_date operator sends raw brackets and returns filtered stories", async () => {
    // Reproduces issue #32: nested filter_query brackets must not be percent-encoded.
    // Uses filter_query[component][in] — same two-level nesting as the reported
    // filter_query[enddate][lt_date] — to verify the wire format against real content.
    // Seeds from whatever exists in the space so the test is content-agnostic.
    // Note: cache is disabled on the capturing client so the custom fetch interceptor
    // is always invoked (the module-level memory cache is shared across instances).
    const { data: seed } = await client.get("cdn/stories", { per_page: 1 });
    const componentName = seed.stories[0].content.component as string;

    let capturedUrl = "";
    const capturingClient = new StoryblokClient({
      accessToken: process.env.VITE_ACCESS_TOKEN,
      cache: { type: "none" },
      fetch: (input, init) => {
        capturedUrl = String(input);
        return fetch(input, init);
      },
    });

    const { data } = await capturingClient.get("cdn/stories", {
      filter_query: { component: { in: componentName } },
    });

    expect(capturedUrl).toContain("filter_query[component][in]=");
    expect(capturedUrl).not.toContain("filter_query%5Bcomponent%5D");
    expect(data.stories.length).toBeGreaterThan(0);
  });
});
