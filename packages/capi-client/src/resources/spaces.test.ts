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

    // First poll: the cv already matches this space version, so nothing was published
    // in between and there is nothing to flush.
    await client.spaces.get();
    await client.get("v2/cdn/links", { query: { version: "published" } });
    expect(linkRequests).toBe(1);

    spaceVersion = 2000; // content was published
    await client.spaces.get();
    await client.get("v2/cdn/links", { query: { version: "published" } });

    expect(linkRequests).toBe(2); // cache was flushed, content re-fetched
  });

  it("should ignore a space.version reported by another endpoint", async () => {
    // The signal is gated on the path, not only on the response shape: a `space.version`
    // that a content response happens to embed must never flush the cache.
    let spaceVersion = 2000;
    let linkRequests = 0;
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/links", () => {
        linkRequests++;
        return HttpResponse.json({
          links: {},
          cv: 1000,
          space: { id: 1, name: "Test Space", version: spaceVersion },
        });
      }),
    );
    const client = createApiClient({ accessToken: "test-token" });

    await client.get("v2/cdn/links", { query: { version: "published" } });
    expect(linkRequests).toBe(1);

    // A second, differently keyed request reports a moved space version.
    spaceVersion = 3000;
    await client.get("v2/cdn/links", { query: { version: "published", starts_with: "blog" } });
    expect(linkRequests).toBe(2);

    // The first entry must still be cached: nothing reported a new cv, and a content
    // response's `space.version` is not a flush signal.
    await client.get("v2/cdn/links", { query: { version: "published" } });

    expect(linkRequests).toBe(2);
  });

  it("should not attach a cv to the poll request", async () => {
    // The `cv` is a cache buster and `/cdn/spaces/me` is not cached: attaching one only
    // fragments the edge cache of the endpoint the polling pattern depends on.
    const spaceUrls: string[] = [];
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/spaces/me", ({ request }) => {
        spaceUrls.push(request.url);
        return HttpResponse.json({
          space: { id: 1, name: "Test Space", version: 1000, language_codes: [] },
        });
      }),
      http.get("https://api.storyblok.com/v2/cdn/links", () => {
        return HttpResponse.json({ links: {}, cv: 1000 });
      }),
    );
    const client = createApiClient({ accessToken: "test-token" });

    await client.get("v2/cdn/links", { query: { version: "published" } });
    await client.spaces.get();

    expect(spaceUrls).toHaveLength(1);
    expect(new URL(spaceUrls[0]).searchParams.has("cv")).toBe(false);
  });

  it("should revalidate on the first poll when the cv does not match the space version", async () => {
    // A publish may have landed between the first content request and this first poll.
    // There is no earlier space version to detect it with, and a cv that no longer
    // matches the space version could equally be a Minimum Cache TTL flooring it. The
    // ambiguity is settled by one revalidation against the origin, not by a flush.
    let linkRequests = 0;
    server.use(
      spaceHandler(() => 2000),
      http.get("https://api.storyblok.com/v2/cdn/links", () => {
        linkRequests++;
        return HttpResponse.json({ links: {}, cv: 1000 });
      }),
    );
    const client = createApiClient({ accessToken: "test-token" });

    await client.get("v2/cdn/links", { query: { version: "published" } });
    await client.spaces.get();
    await client.get("v2/cdn/links", { query: { version: "published" } });
    expect(linkRequests).toBe(2);

    // …but only once: further polls at the same version must not revalidate again.
    await client.spaces.get();
    await client.get("v2/cdn/links", { query: { version: "published" } });
    expect(linkRequests).toBe(2);
  });

  it("should send the revalidation without a cv", async () => {
    // The tracked cv is dropped before the revalidation so the origin redirects it to
    // the current cv. Reusing the old one could be served from a warm `?cv=<old>` edge
    // object and report the very cv it was sent with, hiding a real publish.
    const linkUrls: string[] = [];
    server.use(
      spaceHandler(() => 2000),
      http.get("https://api.storyblok.com/v2/cdn/links", ({ request }) => {
        linkUrls.push(request.url);
        return HttpResponse.json({ links: {}, cv: 1000 });
      }),
    );
    const client = createApiClient({ accessToken: "test-token" });

    await client.get("v2/cdn/links", { query: { version: "published" } });
    await client.spaces.get();
    await client.get("v2/cdn/links", { query: { version: "published" } });

    expect(linkUrls).toHaveLength(2);
    expect(new URL(linkUrls[1]).searchParams.has("cv")).toBe(false);
  });

  it("should keep every other cached entry when the revalidated cv is unchanged", async () => {
    // A Minimum Cache TTL floors the cv permanently, so the pair never matches and the
    // sighting is ambiguous on every fresh client. The revalidation proves nothing was
    // published, and entries this client never revalidated have to survive it.
    let tagRequests = 0;
    server.use(
      spaceHandler(() => 1786950860),
      http.get("https://api.storyblok.com/v2/cdn/links", () =>
        HttpResponse.json({ links: {}, cv: 1786950000 }),
      ),
      http.get("https://api.storyblok.com/v2/cdn/tags", () => {
        tagRequests++;
        return HttpResponse.json({ tags: [], cv: 1786950000 });
      }),
    );
    const client = createApiClient({ accessToken: "ttl-token" });

    await client.get("v2/cdn/tags", { query: { version: "published" } });
    await client.get("v2/cdn/links", { query: { version: "published" } });
    expect(tagRequests).toBe(1);

    await client.spaces.get();
    await client.get("v2/cdn/links", { query: { version: "published" } }); // revalidates

    await client.get("v2/cdn/tags", { query: { version: "published" } });
    expect(tagRequests).toBe(1); // still cached, nothing was published
  });

  it("should flush every cached entry when the revalidated cv moved", async () => {
    // Without a TTL the two values report the same raw version, so an unequal pair means
    // a publish really did land. The revalidation returns the new cv and the whole cache
    // has to go — including entries for other keys.
    let cv = 1000;
    let tagRequests = 0;
    server.use(
      spaceHandler(() => cv),
      http.get("https://api.storyblok.com/v2/cdn/links", () =>
        HttpResponse.json({ links: {}, cv }),
      ),
      http.get("https://api.storyblok.com/v2/cdn/tags", () => {
        tagRequests++;
        return HttpResponse.json({ tags: [], cv });
      }),
    );
    const client = createApiClient({ accessToken: "test-token" });

    await client.get("v2/cdn/tags", { query: { version: "published" } });
    await client.get("v2/cdn/links", { query: { version: "published" } });
    expect(tagRequests).toBe(1);

    cv = 2000; // content published between the content requests and the first poll
    await client.spaces.get();
    await client.get("v2/cdn/links", { query: { version: "published" } }); // revalidates

    await client.get("v2/cdn/tags", { query: { version: "published" } });
    expect(tagRequests).toBe(2); // cache was flushed, the stale entry is gone
  });

  it("should not empty a shared provider once per client instance", async () => {
    // The tracked versions live on the client, so with a provider shared across clients
    // and a TTL-floored cv every newly created client sees the same ambiguous pair. A
    // flush there would empty the shared cache once per instance; a revalidation is
    // scoped to the instance that made it, and a warm shared entry answers it.
    let linkRequests = 0;
    server.use(
      spaceHandler(() => 1786950860),
      http.get("https://api.storyblok.com/v2/cdn/links", () => {
        linkRequests++;
        return HttpResponse.json({ links: {}, cv: 1786950000 });
      }),
    );
    const store = new Map<string, { value: unknown; ttlMs?: number }>();
    const sharedProvider = {
      get: async (key: string) => store.get(key) as never,
      set: async (key: string, entry: { value: unknown; ttlMs?: number }) => {
        store.set(key, entry);
      },
      flush: async () => {
        store.clear();
      },
    };

    // One client per request, as in SSR or serverless.
    for (let i = 0; i < 3; i++) {
      const client = createApiClient({
        accessToken: "ttl-token",
        cache: { provider: sharedProvider, ttlMs: 3_600_000 },
      });
      await client.get("v2/cdn/links", { query: { version: "published" } });
      await client.spaces.get();
    }

    expect(linkRequests).toBe(1);
    expect(store.size).toBe(1);
  });

  it("should ignore a space.version reported by another endpoint", async () => {
    // The signal is gated on the path, not only on the response shape: a `space.version`
    // that a content response happens to embed must never flush the cache.
    let spaceVersion = 2000;
    let linkRequests = 0;
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/links", () => {
        linkRequests++;
        return HttpResponse.json({
          links: {},
          cv: 1000,
          space: { id: 1, name: "Test Space", version: spaceVersion },
        });
      }),
    );
    const client = createApiClient({ accessToken: "test-token" });

    await client.get("v2/cdn/links", { query: { version: "published" } });
    expect(linkRequests).toBe(1);

    // A second, differently keyed request reports a moved space version.
    spaceVersion = 3000;
    await client.get("v2/cdn/links", { query: { version: "published", starts_with: "blog" } });
    expect(linkRequests).toBe(2);

    // The first entry must still be cached: nothing reported a new cv, and a content
    // response's `space.version` is not a flush signal.
    await client.get("v2/cdn/links", { query: { version: "published" } });

    expect(linkRequests).toBe(2);
  });

  it("should not attach a cv to the poll request", async () => {
    // The `cv` is a cache buster and `/cdn/spaces/me` is not cached: attaching one only
    // fragments the edge cache of the endpoint the polling pattern depends on.
    const spaceUrls: string[] = [];
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/spaces/me", ({ request }) => {
        spaceUrls.push(request.url);
        return HttpResponse.json({
          space: { id: 1, name: "Test Space", version: 1000, language_codes: [] },
        });
      }),
      http.get("https://api.storyblok.com/v2/cdn/links", () => {
        return HttpResponse.json({ links: {}, cv: 1000 });
      }),
    );
    const client = createApiClient({ accessToken: "test-token" });

    await client.get("v2/cdn/links", { query: { version: "published" } });
    await client.spaces.get();

    expect(spaceUrls).toHaveLength(1);
    expect(new URL(spaceUrls[0]).searchParams.has("cv")).toBe(false);
  });

  it("should flush on the first poll when the cv does not match the space version", async () => {
    // A publish may have landed between the first content request and this first poll.
    // There is no earlier space version to detect it with, but a cv that no longer
    // matches the space version gives it away, so flush once defensively.
    let linkRequests = 0;
    server.use(
      spaceHandler(() => 2000),
      http.get("https://api.storyblok.com/v2/cdn/links", () => {
        linkRequests++;
        return HttpResponse.json({ links: {}, cv: 1000 });
      }),
    );
    const client = createApiClient({ accessToken: "test-token" });

    await client.get("v2/cdn/links", { query: { version: "published" } });
    await client.spaces.get();
    await client.get("v2/cdn/links", { query: { version: "published" } });
    expect(linkRequests).toBe(2);

    // …but only once: further polls at the same version must not flush again.
    await client.spaces.get();
    await client.get("v2/cdn/links", { query: { version: "published" } });
    expect(linkRequests).toBe(2);
  });

  it("should omit the stale cv on the request that follows a space version flush", async () => {
    // The edge keeps serving the old object for `?cv=<old>` for up to a week, so the
    // refetch after a flush must not carry the cv it was just flushed for. Dropping it
    // makes the request go out without `cv` and take the origin's 301 to the current one.
    let spaceVersion = 1000;
    const linkUrls: string[] = [];
    server.use(
      spaceHandler(() => spaceVersion),
      http.get("https://api.storyblok.com/v2/cdn/links", ({ request }) => {
        linkUrls.push(request.url);
        return HttpResponse.json({ links: {}, cv: spaceVersion });
      }),
    );
    const client = createApiClient({ accessToken: "test-token" });

    await client.get("v2/cdn/links", { query: { version: "published" } });
    expect(new URL(linkUrls[0]).searchParams.get("cv")).toBeNull(); // nothing tracked yet

    spaceVersion = 2000; // content was published
    await client.spaces.get();
    await client.get("v2/cdn/links", { query: { version: "published" } });

    const lastUrl = linkUrls[linkUrls.length - 1];
    expect(new URL(lastUrl).searchParams.get("cv")).toBeNull();
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
    await client.spaces.get(); // cv already matches, nothing to flush
    for (let i = 0; i < 3; i++) {
      await client.spaces.get();
      await client.get("v2/cdn/links", { query: { version: "published" } });
    }

    expect(linkRequests).toBe(1);
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
    await client.spaces.get(); // cv already matches, nothing to flush
    await client.get("v2/cdn/links", { query: { version: "published" } });
    expect(linkUrls).toHaveLength(1); // still cached

    spaceVersion = 2000; // content was published
    await client.spaces.get();
    await client.get("v2/cdn/links", { query: { version: "published" } });
    expect(linkUrls).toHaveLength(2); // cache was flushed, content re-fetched

    expect(linkUrls.every((url) => !url.includes("cv="))).toBe(true);
  });

  it("should not flush when polled before any content request", async () => {
    // Polling before the first content request is the recommended startup shape: there
    // is no cv and no cache yet, so there is nothing to flush.
    let linkRequests = 0;
    server.use(
      spaceHandler(() => 1000),
      http.get("https://api.storyblok.com/v2/cdn/links", () => {
        linkRequests++;
        return HttpResponse.json({ links: {}, cv: 1000 });
      }),
    );
    const client = createApiClient({ accessToken: "test-token" });

    await client.spaces.get();
    await client.get("v2/cdn/links", { query: { version: "published" } });
    await client.spaces.get();
    await client.get("v2/cdn/links", { query: { version: "published" } });

    expect(linkRequests).toBe(1);
  });

  it("should ignore a space version that is not a number", async () => {
    let linkRequests = 0;
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/spaces/me", () =>
        HttpResponse.json({ space: { id: 1, name: "Test Space", version: "2000" } }),
      ),
      http.get("https://api.storyblok.com/v2/cdn/links", () => {
        linkRequests++;
        return HttpResponse.json({ links: {}, cv: 1000 });
      }),
    );
    const client = createApiClient({ accessToken: "test-token" });

    await client.get("v2/cdn/links", { query: { version: "published" } });
    await client.spaces.get();
    await client.spaces.get();
    await client.get("v2/cdn/links", { query: { version: "published" } });

    expect(linkRequests).toBe(1);
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

  it("should retry the revalidation after it failed with an error response", async () => {
    // `currentSpaceVersion` has already advanced, so a signal consumed before the
    // response arrives leaves nothing able to settle it — stale until the next publish.
    let cv = 1000;
    let linksFail = false;
    let tagRequests = 0;
    server.use(
      spaceHandler(() => cv),
      http.get("https://api.storyblok.com/v2/cdn/links", () =>
        linksFail
          ? HttpResponse.json({ error: "Server error" }, { status: 500 })
          : HttpResponse.json({ links: {}, cv }),
      ),
      http.get("https://api.storyblok.com/v2/cdn/tags", () => {
        tagRequests++;
        return HttpResponse.json({ tags: [], cv });
      }),
    );
    const client = createApiClient({ accessToken: "test-token", retry: { limit: 0 } });

    await client.get("v2/cdn/tags", { query: { version: "published" } });
    await client.get("v2/cdn/links", { query: { version: "published" } });
    expect(tagRequests).toBe(1);

    cv = 2000; // content published between the content requests and the first poll
    await client.spaces.get();

    // The caller still gets the cached entry: settling a sighting must not surface an
    // error on a read that would otherwise have been a cache hit.
    linksFail = true;
    const failed = await client.get("v2/cdn/links", { query: { version: "published" } });
    expect(failed.error).toBeUndefined();
    expect(failed.data).toEqual({ links: {}, cv: 1000 });

    // The signal survived, so the next cacheable request retries it and settles it.
    linksFail = false;
    await client.get("v2/cdn/links", { query: { version: "published" } });

    await client.get("v2/cdn/tags", { query: { version: "published" } });
    expect(tagRequests).toBe(2); // cache was flushed, the stale entry is gone
  });

  it("should retry the revalidation after it failed with a network error", async () => {
    let cv = 1000;
    let linksFail = false;
    let tagRequests = 0;
    server.use(
      spaceHandler(() => cv),
      http.get("https://api.storyblok.com/v2/cdn/links", () =>
        linksFail ? HttpResponse.error() : HttpResponse.json({ links: {}, cv }),
      ),
      http.get("https://api.storyblok.com/v2/cdn/tags", () => {
        tagRequests++;
        return HttpResponse.json({ tags: [], cv });
      }),
    );
    const client = createApiClient({ accessToken: "test-token", retry: { limit: 0 } });

    await client.get("v2/cdn/tags", { query: { version: "published" } });
    await client.get("v2/cdn/links", { query: { version: "published" } });

    cv = 2000;
    await client.spaces.get();

    linksFail = true;
    await expect(
      client.get("v2/cdn/links", { query: { version: "published" } }),
    ).resolves.toMatchObject({ data: { cv: 1000 } });

    linksFail = false;
    await client.get("v2/cdn/links", { query: { version: "published" } });

    await client.get("v2/cdn/tags", { query: { version: "published" } });
    expect(tagRequests).toBe(2);
  });

  it.each(["cache-first", "network-first", "swr"] as const)(
    "should keep serving the cached entry when the revalidation fails with the %s strategy",
    async (strategy) => {
      // The revalidation goes through a strategy, so a failing origin cannot cost
      // `network-first` its cached fallback or turn a `cache-first` hit into a throw.
      let cv = 1000;
      let linksFail = false;
      server.use(
        spaceHandler(() => cv),
        http.get("https://api.storyblok.com/v2/cdn/links", () =>
          linksFail ? HttpResponse.error() : HttpResponse.json({ links: {}, cv }),
        ),
      );
      const client = createApiClient({
        accessToken: "test-token",
        retry: { limit: 0 },
        cache: { strategy },
      });

      await client.get("v2/cdn/links", { query: { version: "published" } });

      cv = 2000;
      await client.spaces.get();

      linksFail = true;
      await expect(
        client.get("v2/cdn/links", { query: { version: "published" } }),
      ).resolves.toMatchObject({ data: { cv: 1000 } });
    },
  );
});
