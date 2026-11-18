import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { createApiClient } from "../index";

const STRATA_SEARCH_URL = "https://api.storyblok.com/v2/cdn/strata/search";

const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const hit = {
  excerpt: "Our pricing scales with usage.",
  score: 0.92,
  story: { id: 1001, slug: "pricing", name: "Pricing" },
};

describe("strata.search()", () => {
  it("should return the search hits", async () => {
    server.use(http.get(STRATA_SEARCH_URL, () => HttpResponse.json({ results: [hit] })));
    const client = createApiClient({ accessToken: "test-token" });

    const result = await client.strata.search({ query: { q: "pricing" } });

    expect(result.error).toBeUndefined();
    expect(result.data?.results).toEqual([hit]);
  });

  it("should send the search params", async () => {
    let searchParams: URLSearchParams | undefined;
    server.use(
      http.get(STRATA_SEARCH_URL, ({ request }) => {
        searchParams = new URL(request.url).searchParams;
        return HttpResponse.json({ results: [] });
      }),
    );
    const client = createApiClient({ accessToken: "test-token" });

    await client.strata.search({
      query: {
        q: "pricing",
        version: "draft",
        limit: 10,
        starts_with: "docs/",
        content_type: "article",
      },
    });

    expect(Object.fromEntries(searchParams ?? [])).toEqual({
      q: "pricing",
      version: "draft",
      limit: "10",
      starts_with: "docs/",
      content_type: "article",
      token: "test-token",
    });
  });

  it("should not cache published searches", async () => {
    let calls = 0;
    server.use(
      http.get(STRATA_SEARCH_URL, () => {
        calls++;
        return HttpResponse.json({ results: [{ ...hit, score: calls }] });
      }),
    );
    const client = createApiClient({ accessToken: "test-token" });

    await client.strata.search({ query: { q: "pricing", version: "published" } });
    const second = await client.strata.search({ query: { q: "pricing", version: "published" } });

    expect(calls).toBe(2);
    expect(second.data?.results[0]?.score).toBe(2);
  });

  it("should not cache searches made through get()", async () => {
    let calls = 0;
    server.use(
      http.get(STRATA_SEARCH_URL, () => {
        calls++;
        return HttpResponse.json({ results: [] });
      }),
    );
    const client = createApiClient({ accessToken: "test-token" });

    await client.get("/v2/cdn/strata/search", { query: { q: "pricing" } });
    await client.get("/v2/cdn/strata/search", { query: { q: "pricing" } });

    expect(calls).toBe(2);
  });

  it("should return the error when Strata is disabled for the space", async () => {
    const body = {
      error: {
        message: "Strata is disabled for this space",
        code: "feature_disabled",
        details: null,
        timestamp: "2026-11-04T00:00:00Z",
      },
    };
    server.use(http.get(STRATA_SEARCH_URL, () => HttpResponse.json(body, { status: 403 })));
    const client = createApiClient({ accessToken: "test-token" });

    const result = await client.strata.search({ query: { q: "pricing" } });

    expect(result.data).toBeUndefined();
    expect(result.response.status).toBe(403);
  });

  it("should throw when throwOnError is set", async () => {
    server.use(http.get(STRATA_SEARCH_URL, () => HttpResponse.json({}, { status: 503 })));
    const client = createApiClient({ accessToken: "test-token" });

    await expect(
      client.strata.search({ query: { q: "pricing" }, throwOnError: true }),
    ).rejects.toThrow();
  });
});
