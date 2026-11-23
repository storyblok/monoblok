import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { createManagementApiClient } from "../index";

const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const SEARCH_URL = "https://mapi.storyblok.com/v1/spaces/:space_id/strata/search";

const hit = {
  excerpt: "Our pricing plans",
  score: 0.82,
  story: { id: 1, slug: "pricing", name: "Pricing" },
};

function createClient() {
  return createManagementApiClient({
    personalAccessToken: "test-token",
    spaceId: 123,
    region: "eu",
    rateLimit: false,
  });
}

describe("strata.search()", () => {
  it("should send the query to the space's search endpoint", async () => {
    let requested: URL | undefined;
    server.use(
      http.get(SEARCH_URL, ({ request }) => {
        requested = new URL(request.url);
        return HttpResponse.json({ results: [hit] });
      }),
    );

    const result = await createClient().strata.search({
      query: { q: "pricing", version: "draft", limit: 50, starts_with: "docs/" },
    });

    expect(result.data?.results).toEqual([hit]);
    expect(requested?.pathname).toBe("/v1/spaces/123/strata/search");
    expect(Object.fromEntries(requested?.searchParams ?? [])).toEqual({
      q: "pricing",
      version: "draft",
      limit: "50",
      starts_with: "docs/",
    });
  });

  it("should search another space when the path overrides it", async () => {
    let spaceId: string | undefined;
    server.use(
      http.get(SEARCH_URL, ({ params }) => {
        spaceId = String(params.space_id);
        return HttpResponse.json({ results: [] });
      }),
    );

    await createClient().strata.search({ query: { q: "pricing" }, path: { space_id: 999 } });

    expect(spaceId).toBe("999");
  });

  it("should return Strata's error body on a rejected search", async () => {
    const body = {
      error: {
        message: "Strata is not enabled",
        code: "feature_disabled",
        details: null,
        timestamp: "2026-11-17T10:00:00Z",
      },
    };
    server.use(http.get(SEARCH_URL, () => HttpResponse.json(body, { status: 403 })));

    const result = await createClient().strata.search({ query: { q: "pricing" } });

    expect(result.data).toBeUndefined();
    expect(result.error).toMatchObject({ response: { status: 403, data: body } });
  });
});
