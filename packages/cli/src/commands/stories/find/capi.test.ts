import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CAPI_BATCH_SIZE, createCapiContentFetcher, parseCapiParams } from "./capi";
import { getMapiClient } from "../../../api";
import { CommandError } from "../../../utils/error/command-error";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  getMapiClient({ personalAccessToken: "valid-token", region: "eu" });
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("parseCapiParams", () => {
  it("returns no params when the flag was not passed", () => {
    expect(parseCapiParams(undefined)).toEqual({});
    expect(parseCapiParams("  ")).toEqual({});
  });

  it("parses a JSON object", () => {
    expect(parseCapiParams('{"version":"published","language":"de"}')).toEqual({
      version: "published",
      language: "de",
    });
  });

  it("parses an object written without JSON quoting", () => {
    expect(parseCapiParams("{version: published, language: de}")).toEqual({
      version: "published",
      language: "de",
    });
  });

  it("parses bare key=value pairs", () => {
    expect(parseCapiParams("version=published,language=de")).toEqual({
      version: "published",
      language: "de",
    });
  });

  it("accepts & as a pair separator, as in a query string", () => {
    expect(parseCapiParams("version=published&language=de")).toEqual({
      version: "published",
      language: "de",
    });
  });

  it("rewrites the lang alias to the language CDN parameter", () => {
    expect(parseCapiParams("{lang: en}")).toEqual({ language: "en" });
  });

  it("rejects params the CAPI filter owns", () => {
    expect(() => parseCapiParams("per_page=100")).toThrow(CommandError);
    expect(() => parseCapiParams('{"by_uuids":"a,b"}')).toThrow(/cannot set "by_uuids"/);
  });

  it("rejects a value that is neither an object nor pairs", () => {
    expect(() => parseCapiParams("published")).toThrow(CommandError);
  });

  it("rejects a JSON array", () => {
    expect(() => parseCapiParams("[1,2]")).toThrow(CommandError);
  });
});

const preconditions = {
  hasSpaceWithPreviewToken(token: string) {
    server.use(
      http.get("https://mapi.storyblok.com/v1/spaces/12345", () =>
        HttpResponse.json({ space: { id: 12345, name: "Test", first_token: token } }),
      ),
    );
  },
  hasSpaceWithoutPreviewToken() {
    server.use(
      http.get("https://mapi.storyblok.com/v1/spaces/12345", () =>
        HttpResponse.json({ space: { id: 12345, name: "Test" } }),
      ),
    );
  },
  /** Records every CDN request so the query the fetcher builds can be asserted. */
  canFetchCdnStories(stories: Array<{ uuid: string; content: Record<string, unknown> }>) {
    const requests: URL[] = [];
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories", ({ request }) => {
        requests.push(new URL(request.url));
        return HttpResponse.json({ stories });
      }),
    );
    return requests;
  },
};

describe("createCapiContentFetcher", () => {
  it("maps content by uuid", async () => {
    preconditions.hasSpaceWithPreviewToken("preview-token");
    preconditions.canFetchCdnStories([
      { uuid: "uuid-1", content: { _uid: "a", component: "page" } },
      { uuid: "uuid-2", content: { _uid: "b", component: "post" } },
    ]);

    const fetchContent = await createCapiContentFetcher({
      spaceId: "12345",
      region: "eu",
      params: {},
    });
    const content = await fetchContent(["uuid-1", "uuid-2"]);

    expect(content.get("uuid-1")).toEqual({ _uid: "a", component: "page" });
    expect(content.get("uuid-2")).toEqual({ _uid: "b", component: "post" });
  });

  it("requests drafts in batches of 25 with the space's preview token", async () => {
    preconditions.hasSpaceWithPreviewToken("preview-token");
    const requests = preconditions.canFetchCdnStories([]);

    const fetchContent = await createCapiContentFetcher({
      spaceId: "12345",
      region: "eu",
      params: {},
    });
    await fetchContent(["uuid-1", "uuid-2"]);

    const query = requests[0].searchParams;
    expect(query.get("by_uuids")).toBe("uuid-1,uuid-2");
    expect(query.get("per_page")).toBe(String(CAPI_BATCH_SIZE));
    expect(query.get("version")).toBe("draft");
    expect(query.get("token")).toBe("preview-token");
  });

  it("lets --capi-params override the version it asks for", async () => {
    preconditions.hasSpaceWithPreviewToken("preview-token");
    const requests = preconditions.canFetchCdnStories([]);

    const fetchContent = await createCapiContentFetcher({
      spaceId: "12345",
      region: "eu",
      params: { version: "published", language: "de" },
    });
    await fetchContent(["uuid-1"]);

    expect(requests[0].searchParams.get("version")).toBe("published");
    expect(requests[0].searchParams.get("language")).toBe("de");
  });

  it("omits stories the CDN did not answer for, rather than guessing", async () => {
    preconditions.hasSpaceWithPreviewToken("preview-token");
    preconditions.canFetchCdnStories([
      { uuid: "uuid-1", content: { _uid: "a", component: "page" } },
    ]);

    const fetchContent = await createCapiContentFetcher({
      spaceId: "12345",
      region: "eu",
      params: {},
    });
    const content = await fetchContent(["uuid-1", "uuid-missing"]);

    expect(content.has("uuid-1")).toBe(true);
    expect(content.has("uuid-missing")).toBe(false);
  });

  it("fails before any story is listed when the space has no preview token", async () => {
    preconditions.hasSpaceWithoutPreviewToken();

    await expect(
      createCapiContentFetcher({ spaceId: "12345", region: "eu", params: {} }),
    ).rejects.toThrow(CommandError);
  });
});
