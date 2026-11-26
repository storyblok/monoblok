import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { createApiClient } from "../index";
import { redirectToCurrentCv } from "../../test/origin";

const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("datasources.list()", () => {
  it("should successfully retrieve multiple datasources", async () => {
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/datasources", () => {
        return HttpResponse.json({ datasources: [{ id: 123, name: "Example", slug: "example" }] });
      }),
    );
    const client = createApiClient({
      accessToken: "test-token",
    });

    const result = await client.datasources.list();

    expect(result.error).toBeUndefined();
    expect(Array.isArray(result.data?.datasources)).toBe(true);
  });

  it("should return error on 401", async () => {
    vi.useFakeTimers();
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/datasources", () => {
        return HttpResponse.json({ error: "Unauthorized" }, { status: 401 });
      }),
    );
    const client = createApiClient({
      accessToken: "invalid-token",
    });

    const resultPromise = client.datasources.list();
    await vi.runOnlyPendingTimersAsync();
    const result = await resultPromise;

    expect(result.error).toBeDefined();
    expect(result.data).toBeUndefined();
    expect(result.response.status).toBe(401);
    vi.useRealTimers();
  });
});

describe("datasources.get()", () => {
  it("should successfully retrieve a single datasource", async () => {
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/datasources/*", () => {
        return HttpResponse.json({ datasource: { id: 123, name: "Example", slug: "example" } });
      }),
    );
    const client = createApiClient({
      accessToken: "test-token",
    });

    const result = await client.datasources.get("123");

    expect(result.error).toBeUndefined();
    expect(typeof result.data?.datasource).toBe("object");
  });

  it("should return error on 401", async () => {
    vi.useFakeTimers();
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/datasources/*", () => {
        return HttpResponse.json({ error: "Unauthorized" }, { status: 401 });
      }),
    );
    const client = createApiClient({
      accessToken: "invalid-token",
    });

    const resultPromise = client.datasources.get("123");
    await vi.runOnlyPendingTimersAsync();
    const result = await resultPromise;

    expect(result.error).toBeDefined();
    expect(result.data).toBeUndefined();
    expect(result.response.status).toBe(401);
    vi.useRealTimers();
  });

  it("should forward tracked cv to datasource requests", async () => {
    server.use(
      http.get(
        "https://api.storyblok.com/v2/cdn/links",
        ({ request }) => redirectToCurrentCv(request, 42) ?? HttpResponse.json({ links: {} }),
      ),
      http.get(
        "https://api.storyblok.com/v2/cdn/datasources/*",
        ({ request }: { request: Request }) => {
          const url = new URL(request.url);
          return HttpResponse.json({
            cv: Number(url.searchParams.get("cv") || 0),
            datasource: { id: 123, name: "Example", slug: "example" },
          });
        },
      ),
    );
    const client = createApiClient({
      accessToken: "test-token",
    });

    await client.links.list({ query: { version: "published" } });
    const result = await client.datasources.get("123");

    expect(result.error).toBeUndefined();
    expect(result.data?.cv).toBe(42);
  });
});

describe("datasources.list() and the content version", () => {
  /**
   * Redirects a story request without a `cv` to the current one. Datasources are answered from
   * the edge cache under any URL, so a request without a `cv` gets whatever was current when
   * the edge first cached it, unless `redirectsDatasources` is set.
   */
  const createCdn = ({ redirectsDatasources = false } = {}) => {
    const cdn = { cv: 2000, storyRequests: [] as URL[], datasourceRequests: 0 };
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories/:slug", ({ request }) => {
        const url = new URL(request.url);
        cdn.storyRequests.push(new URL(request.url));
        if (url.searchParams.get("cv") !== String(cdn.cv)) {
          url.searchParams.set("cv", String(cdn.cv));
          return HttpResponse.redirect(url.toString(), 301);
        }
        return HttpResponse.json({
          story: { id: 1, name: `story at ${cdn.cv}`, content: {} },
          cv: cdn.cv,
        });
      }),
      http.get("https://api.storyblok.com/v2/cdn/datasources", ({ request }) => {
        if (redirectsDatasources) {
          const redirect = redirectToCurrentCv(request, cdn.cv);
          if (redirect) {
            return redirect;
          }
        }
        cdn.datasourceRequests++;
        // Without a cv, the copy the edge cached a week ago, before content was published. A
        // URL with a cv was first cached once that cv existed.
        const cv = Number(new URL(request.url).searchParams.get("cv")) || 1000;
        return HttpResponse.json({ datasources: [], cv });
      }),
    );
    return cdn;
  };

  it("should not learn the cv of a datasources response the edge cached long ago", async () => {
    const cdn = createCdn();
    const client = createApiClient({ accessToken: "datasources-first" });

    await client.datasources.list();
    const story = await client.stories.get("home");

    expect(story.data?.story.name).toBe("story at 2000");
    expect(cdn.storyRequests[0]?.searchParams.has("cv")).toBe(false);
  });

  it("should learn the cv a datasources request was redirected to", async () => {
    const cdn = createCdn({ redirectsDatasources: true });
    const client = createApiClient({ accessToken: "datasources-redirected" });

    await client.datasources.list();
    await client.stories.get("home");

    expect(cdn.storyRequests).toHaveLength(1);
    expect(cdn.storyRequests[0]?.searchParams.get("cv")).toBe("2000");
  });

  it("should not learn a datasources body cv when a custom fetch drops the response URL", async () => {
    const cdn = createCdn();
    const client = createApiClient({
      accessToken: "datasources-rebuilt",
      fetch: async (input, init) => {
        const response = await fetch(input, init);
        return new Response(response.body, response);
      },
    });

    await client.datasources.list();
    await client.stories.get("home");

    expect(cdn.storyRequests[0]?.searchParams.has("cv")).toBe(false);
  });

  it("should invalidate cached datasources when a publish is noticed", async () => {
    const cdn = createCdn();
    let spaceVersion = 2000;
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/spaces/me", () =>
        HttpResponse.json({ space: { id: 1, name: "Space", version: spaceVersion } }),
      ),
    );
    const client = createApiClient({ accessToken: "datasources-invalidation" });
    await client.stories.get("home");
    await client.spaces.get();
    await client.datasources.list();
    await client.datasources.list();
    expect(cdn.datasourceRequests).toBe(1);

    spaceVersion = 3000;
    cdn.cv = 3000;
    await client.spaces.get();
    await client.datasources.list();

    expect(cdn.datasourceRequests).toBe(2);
  });

  it("should cache datasources in an app that reads nothing else", async () => {
    const cdn = createCdn();
    const client = createApiClient({ accessToken: "datasources-only" });

    await client.datasources.list();
    await client.datasources.list();
    await client.datasources.list({ query: { per_page: 10 } });
    await client.datasources.list({ query: { per_page: 10 } });

    expect(cdn.datasourceRequests).toBe(2);
  });
});
