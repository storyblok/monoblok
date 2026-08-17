import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { createApiClient } from "../index";

const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("spaces.get()", () => {
  it("should successfully retrieve the current space", async () => {
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/spaces/me", () => {
        return HttpResponse.json({
          space: {
            id: 1,
            name: "Test Space",
            domain: "https://test.storyblok.com",
            version: 1,
            language_codes: [],
          },
        });
      }),
    );
    const client = createApiClient({
      accessToken: "test-token",
    });

    const result = await client.spaces.get();

    expect(result.error).toBeUndefined();
    expect(typeof result.data?.space).toBe("object");
  });

  it("should return error on 401", async () => {
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/spaces/me", () => {
        return HttpResponse.json({ error: "Unauthorized" }, { status: 401 });
      }),
    );
    const client = createApiClient({
      accessToken: "invalid-token",
    });

    const result = await client.spaces.get();

    expect(result.error).toBeDefined();
    expect(result.data).toBeUndefined();
    expect(result.response.status).toBe(401);
  });

  it("should include the token in the request URL", async () => {
    let capturedUrl = "";
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/spaces/me", ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          space: {
            id: 1,
            name: "Test Space",
            domain: "https://test.storyblok.com",
            version: 1,
            language_codes: [],
          },
        });
      }),
    );
    const client = createApiClient({
      accessToken: "my-test-token",
    });

    await client.spaces.get();

    const url = new URL(capturedUrl);
    expect(url.searchParams.get("token")).toBe("my-test-token");
  });

  it("should always hit the network (not cached)", async () => {
    let requestCount = 0;
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/spaces/me", () => {
        requestCount++;
        return HttpResponse.json({
          space: {
            id: 1,
            name: "Test Space",
            domain: "https://test.storyblok.com",
            version: 1,
            language_codes: [],
          },
        });
      }),
    );
    const client = createApiClient({
      accessToken: "test-token",
    });

    await client.spaces.get();
    await client.spaces.get();

    expect(requestCount).toBe(2);
  });

  it("should use the custom fetch function when provided", async () => {
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/spaces/me", () => {
        return HttpResponse.json({
          space: {
            id: 1,
            name: "Test Space",
            domain: "https://test.storyblok.com",
            version: 1,
            language_codes: [],
          },
        });
      }),
    );
    const customFetch = vi.fn(globalThis.fetch);
    const client = createApiClient({
      accessToken: "test-token",
      fetch: customFetch,
    });

    const result = await client.spaces.get();

    expect(customFetch).toHaveBeenCalledOnce();
    expect(result.error).toBeUndefined();
  });
});

describe("spaces.get() as a cache invalidation signal", () => {
  // `/cdn/spaces/me` carries no `cv`, only the space's raw `version`. It is cached for
  // two seconds while content endpoints are cached for a week, which makes polling it
  // the cheapest way to notice that content changed.
  const spaceHandler = (version: () => number) =>
    http.get("https://api.storyblok.com/v2/cdn/spaces/me", () => {
      return HttpResponse.json({
        space: {
          id: 1,
          name: "Test Space",
          domain: "https://test.storyblok.com",
          version: version(),
          language_codes: [],
        },
      });
    });

  it("should flush the cache when the space reports a new version", async () => {
    let spaceVersion = 1000;
    let linkRequests = 0;
    server.use(
      spaceHandler(() => spaceVersion),
      http.get("https://api.storyblok.com/v2/cdn/links", () => {
        linkRequests++;
        return HttpResponse.json({ links: {}, cv: 1000 });
      }),
    );
    const client = createApiClient({ accessToken: "test-token" });

    await client.get("v2/cdn/links", { query: { version: "published" } });
    await client.get("v2/cdn/links", { query: { version: "published" } }); // cached
    expect(linkRequests).toBe(1);

    // First poll: content was already served and there is no earlier space version to
    // compare against, so the cache is flushed once defensively.
    await client.spaces.get();
    await client.get("v2/cdn/links", { query: { version: "published" } });
    expect(linkRequests).toBe(2);

    await client.get("v2/cdn/links", { query: { version: "published" } });
    expect(linkRequests).toBe(2); // cached again

    spaceVersion = 2000; // content was published
    await client.spaces.get();
    await client.get("v2/cdn/links", { query: { version: "published" } });

    expect(linkRequests).toBe(3); // cache was flushed, content re-fetched
  });

  it("should not flush the cache while the space version is unchanged", async () => {
    let linkRequests = 0;
    server.use(
      spaceHandler(() => 1000),
      http.get("https://api.storyblok.com/v2/cdn/links", () => {
        linkRequests++;
        return HttpResponse.json({ links: {}, cv: 1000 });
      }),
    );
    const client = createApiClient({ accessToken: "test-token" });

    await client.get("v2/cdn/links", { query: { version: "published" } });
    await client.spaces.get(); // first sighting flushes once
    for (let i = 0; i < 3; i++) {
      await client.spaces.get();
      await client.get("v2/cdn/links", { query: { version: "published" } });
    }

    expect(linkRequests).toBe(2);
  });

  it("should not flush the cache when a Minimum Cache TTL floors the cv", async () => {
    // Tokens with a Minimum Cache TTL receive a `cv` floored into TTL-sized buckets,
    // while `space.version` keeps reporting the raw latest version. The two values
    // differ permanently and must never be compared against each other.
    const flooredCv = 1_786_950_000;
    const rawSpaceVersion = 1_786_950_860;
    let linkRequests = 0;
    server.use(
      spaceHandler(() => rawSpaceVersion),
      http.get("https://api.storyblok.com/v2/cdn/links", () => {
        linkRequests++;
        return HttpResponse.json({ links: {}, cv: flooredCv });
      }),
    );
    const client = createApiClient({ accessToken: "test-token" });

    for (let i = 0; i < 3; i++) {
      await client.spaces.get();
      await client.get("v2/cdn/links", { query: { version: "published" } });
    }

    expect(linkRequests).toBe(1);
  });

  it("should still flush on a space version change when cv is manual", async () => {
    // With `cv: 'manual'` the cv is tracked but never attached to requests, so behind
    // an edge cache a content response can keep carrying a stale cv indefinitely.
    // `space.version` is then the only signal left to notice that content changed.
    let spaceVersion = 1000;
    const linkUrls: string[] = [];
    server.use(
      spaceHandler(() => spaceVersion),
      http.get("https://api.storyblok.com/v2/cdn/links", ({ request }) => {
        linkUrls.push(request.url);
        return HttpResponse.json({ links: {}, cv: 1000 });
      }),
    );
    const client = createApiClient({
      accessToken: "test-token",
      cache: { cv: "manual" },
    });

    await client.get("v2/cdn/links", { query: { version: "published" } });
    await client.spaces.get(); // first sighting, content already served
    await client.get("v2/cdn/links", { query: { version: "published" } });
    expect(linkUrls).toHaveLength(2); // cache was flushed once defensively

    await client.spaces.get();
    await client.get("v2/cdn/links", { query: { version: "published" } });
    expect(linkUrls).toHaveLength(2); // unchanged version, still cached

    spaceVersion = 2000; // content was published
    await client.spaces.get();
    await client.get("v2/cdn/links", { query: { version: "published" } });
    expect(linkUrls).toHaveLength(3); // cache was flushed, content re-fetched

    expect(linkUrls.every((url) => !url.includes("cv="))).toBe(true);
  });

  it("should not auto-flush on a space version change when flush is manual", async () => {
    let spaceVersion = 1000;
    let linkRequests = 0;
    server.use(
      spaceHandler(() => spaceVersion),
      http.get("https://api.storyblok.com/v2/cdn/links", () => {
        linkRequests++;
        return HttpResponse.json({ links: {}, cv: 1000 });
      }),
    );
    const client = createApiClient({
      accessToken: "test-token",
      cache: { flush: "manual" },
    });

    await client.get("v2/cdn/links", { query: { version: "published" } });
    await client.spaces.get();
    spaceVersion = 2000;
    await client.spaces.get();
    await client.get("v2/cdn/links", { query: { version: "published" } });

    expect(linkRequests).toBe(1);
  });
});
