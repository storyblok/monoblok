import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { createApiClient } from "../index";
import type { CacheEntry, CacheEntryInput, CacheProvider } from "../utils/cache";

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
  // `/cdn/spaces/me` reports the space's raw `version` and no `cv`, and is cached for two
  // seconds where content is cached for a week — the cheapest way to notice a publish.
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

  /**
   * A `Map`-backed provider that also reports how many times it was flushed. A request
   * count alone cannot tell a flush from a revalidation: both reach the network.
   */
  const countingProvider = () => {
    const store = new Map<string, CacheEntry>();
    const stats = { flushes: 0 };
    const provider: CacheProvider = {
      // The store is heterogeneous; the caller names the expected type via the generic,
      // exactly as `createMemoryCacheProvider` does.
      get: async <TValue = unknown>(key: string) =>
        store.get(key) as CacheEntry<TValue> | undefined,
      set: async <TValue = unknown>(key: string, entry: CacheEntryInput<TValue>) => {
        store.set(key, { storedAt: Date.now(), ...entry } as CacheEntry);
      },
      flush: async () => {
        stats.flushes++;
        store.clear();
      },
    };
    return { store, stats, provider };
  };

  /** A promise plus its resolver, to hold a response in flight across another request. */
  const deferred = () => {
    let resolve!: () => void;
    const promise = new Promise<void>((settle) => {
      resolve = settle;
    });
    return { promise, resolve };
  };

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
    // Gated on the path, not just the response shape: a `space.version` embedded in a
    // content response must never flush.
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

    // Still cached: nothing reported a new cv, and a content response's `space.version`
    // is not a flush signal.
    await client.get("v2/cdn/links", { query: { version: "published" } });

    expect(linkRequests).toBe(2);
  });

  it("should not attach a cv to the poll request", async () => {
    // The cv is a cache buster and `/cdn/spaces/me` is not cached: one there would only
    // fragment the edge cache of the endpoint polling depends on.
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
    // A publish may have landed between the first content request and this poll, but so
    // could a Minimum Cache TTL flooring the cv. One revalidation settles it, no flush.
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
    // A warm `?cv=<old>` edge object reports the very cv it was sent with, which would
    // hide a real publish — so the revalidation must carry none.
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

  it("should send the revalidation without a cv restored by a request in flight", async () => {
    // Dropping the tracked cv is not enough on its own: a content request that was
    // already out when the sighting was armed restores it on the way back, and the
    // revalidation would then carry the very cv whose edge object hides the publish.
    const gate = deferred();
    const storyUrls: string[] = [];
    let storyRequests = 0;
    server.use(
      spaceHandler(() => 2000),
      http.get("https://api.storyblok.com/v2/cdn/stories", async ({ request }) => {
        storyUrls.push(request.url);
        storyRequests++;
        if (storyRequests === 2) {
          await gate.promise;
        }
        return HttpResponse.json({ stories: [], cv: 1000 });
      }),
    );
    const client = createApiClient({ accessToken: "inflight-cv-token" });

    await client.get("v2/cdn/stories", { query: { version: "published" } }); // tracks cv 1000
    const inFlight = client.get("v2/cdn/stories", { query: { version: "published", page: "2" } });
    await new Promise((resolve) => setTimeout(resolve, 10));

    await client.spaces.get(); // arms the sighting while that request is still out
    gate.resolve();
    await inFlight;

    await client.get("v2/cdn/stories", { query: { version: "published", page: "3" } });

    const lastUrl = storyUrls[storyUrls.length - 1];
    expect(new URL(lastUrl).searchParams.has("cv")).toBe(false);
  });

  it("should strip a caller-supplied cv from the revalidation", async () => {
    // A cv passed by the caller is normally honoured, but a revalidation exists to reach
    // the origin's current version — any cv at all defeats it.
    const storyUrls: string[] = [];
    server.use(
      spaceHandler(() => 2000),
      http.get("https://api.storyblok.com/v2/cdn/stories", ({ request }) => {
        storyUrls.push(request.url);
        return HttpResponse.json({ stories: [], cv: 1000 });
      }),
    );
    const client = createApiClient({ accessToken: "caller-cv-token" });

    await client.get("v2/cdn/stories", { query: { version: "published" } });
    await client.spaces.get();
    await client.get("v2/cdn/stories", { query: { version: "published", cv: 1000 } });

    const lastUrl = storyUrls[storyUrls.length - 1];
    expect(new URL(lastUrl).searchParams.has("cv")).toBe(false);
  });
  it("should keep every other cached entry when the revalidated cv is unchanged", async () => {
    // A Minimum Cache TTL floors the cv permanently, so every fresh client sees an
    // ambiguous pair. The revalidation proves nothing was published; other keys survive.
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
    // Without a TTL both report the same raw version, so an unequal pair means a publish
    // really landed. The whole cache goes, including entries for other keys.
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

  it("should flush when the settling response reports no cv", async () => {
    // `/cdn/tags` and `/cdn/links` report no cv, so a sighting settled by one of them
    // cannot be disambiguated from the response. Consuming the signal there would hide a
    // publish until the entry expired; flushing costs one extra flush per client instead.
    const flooredCv = 1_786_950_000;
    let storyCv = flooredCv;
    let storyRequests = 0;
    server.use(
      spaceHandler(() => 1_786_950_860),
      http.get("https://api.storyblok.com/v2/cdn/stories", () => {
        storyRequests++;
        return HttpResponse.json({ stories: [], cv: storyCv });
      }),
      http.get("https://api.storyblok.com/v2/cdn/tags", () => HttpResponse.json({ tags: [] })),
    );
    const client = createApiClient({ accessToken: "cv-less-settle-token" });

    await client.get("v2/cdn/stories", { query: { version: "published" } });
    expect(storyRequests).toBe(1);

    storyCv = 1_786_960_000; // a publish lands
    await client.spaces.get(); // ambiguous first sighting
    await client.get("v2/cdn/tags", { query: { version: "published" } }); // settles it

    await client.get("v2/cdn/stories", { query: { version: "published" } });
    expect(storyRequests).toBe(2); // the stale entry is gone, not served
  });

  it("should ignore a lower cv reported by a stale edge node while settling", async () => {
    // Only a cv that moved forward means content was published. A lower one is an older
    // edge object answering: flushing for it would empty a shared provider, and tracking
    // it would send `?cv=<older>` on every request after.
    let storyCv = 1000;
    const storyUrls: string[] = [];
    server.use(
      spaceHandler(() => 2000),
      http.get("https://api.storyblok.com/v2/cdn/stories", ({ request }) => {
        storyUrls.push(request.url);
        return HttpResponse.json({ stories: [], cv: storyCv });
      }),
    );
    const { stats, provider } = countingProvider();
    const client = createApiClient({ accessToken: "stale-edge-token", cache: { provider } });

    await client.get("v2/cdn/stories", { query: { version: "published" } }); // tracks cv 1000
    storyCv = 900; // an older edge node answers the revalidation
    await client.spaces.get();
    await client.get("v2/cdn/stories", { query: { version: "published" } }); // settles

    expect(stats.flushes).toBe(0);

    await client.get("v2/cdn/stories", { query: { version: "published", page: "2" } });
    const lastUrl = storyUrls[storyUrls.length - 1];
    expect(new URL(lastUrl).searchParams.get("cv")).toBe("1000"); // never moved backward
  });
  it("should not empty a shared provider once per client instance", async () => {
    // With a shared provider and a TTL-floored cv, every new client sees the same
    // ambiguous pair. A flush would empty the shared cache once per instance; a
    // revalidation is scoped to the client that made it.
    let linkRequests = 0;
    server.use(
      spaceHandler(() => 1786950860),
      http.get("https://api.storyblok.com/v2/cdn/links", () => {
        linkRequests++;
        return HttpResponse.json({ links: {}, cv: 1786950000 });
      }),
    );
    const { store, provider: sharedProvider } = countingProvider();

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

  it("should omit the stale cv on the request that follows a space version flush", async () => {
    // The edge serves `?cv=<old>` for up to a week, so the refetch after a flush must
    // not carry the cv it was flushed for; without one it takes the origin's 301.
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

  it("should not cache a response that was in flight when the cache was flushed", async () => {
    // A response that left before the flush carries the cv the flush just dropped.
    // Storing it would refill the cache it emptied and resurrect that cv, so the content
    // published a moment ago stays invisible for a full `ttlMs`.
    const gate = deferred();
    let spaceVersion = 1000;
    let storyRequests = 0;
    server.use(
      spaceHandler(() => spaceVersion),
      http.get("https://api.storyblok.com/v2/cdn/stories", async () => {
        storyRequests++;
        if (storyRequests === 2) {
          await gate.promise;
        }
        return HttpResponse.json({ stories: [], cv: 1000 }); // pre-publish body and cv
      }),
    );
    const client = createApiClient({ accessToken: "inflight-flush-token" });

    await client.get("v2/cdn/stories", { query: { version: "published" } });
    await client.spaces.get(); // cv already matches, nothing ambiguous

    const inFlight = client.get("v2/cdn/stories", { query: { version: "published", page: "2" } });
    await new Promise((resolve) => setTimeout(resolve, 10));

    spaceVersion = 2000; // content was published
    await client.spaces.get(); // flushes while that request is still out
    gate.resolve();
    await inFlight;

    await client.get("v2/cdn/stories", { query: { version: "published", page: "2" } });
    expect(storyRequests).toBe(3); // refetched rather than served from a refilled cache
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
    // A Minimum Cache TTL floors the cv into buckets while `space.version` reports the
    // raw version: they differ permanently and must never be compared to each other.
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

  it("should flush an ambiguous first sighting when cv is manual", async () => {
    // Deferring works by dropping the cv so the revalidation reaches the origin's current
    // version. Under `cv: 'manual'` requests carry no cv to begin with, so the
    // revalidation is byte-identical to the request before it and a warm edge object
    // answers with the same cv — settling the sighting falsely. Flush instead.
    server.use(
      spaceHandler(() => 2000),
      http.get("https://api.storyblok.com/v2/cdn/stories", () =>
        HttpResponse.json({ stories: [], cv: 1000 }),
      ),
      http.get("https://api.storyblok.com/v2/cdn/tags", () => HttpResponse.json({ tags: [] })),
    );
    const { stats, provider } = countingProvider();
    const client = createApiClient({
      accessToken: "manual-cv-sighting-token",
      cache: { cv: "manual", provider },
    });

    await client.get("v2/cdn/stories", { query: { version: "published" } });
    await client.get("v2/cdn/tags", { query: { version: "published" } });
    expect(stats.flushes).toBe(0);

    await client.spaces.get(); // ambiguous first sighting
    await client.get("v2/cdn/tags", { query: { version: "published" } });

    expect(stats.flushes).toBe(1);
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

  it("should not flush again for a sighting already answered by flushCache", async () => {
    // An explicit flush answers whatever a pending sighting was about to ask. Leaving the
    // signal armed forces the next request onto the network and empties the provider a
    // second time — which every other client sharing it pays for.
    server.use(
      spaceHandler(() => 2000),
      http.get("https://api.storyblok.com/v2/cdn/stories", () =>
        HttpResponse.json({ stories: [], cv: 1000 }),
      ),
      http.get("https://api.storyblok.com/v2/cdn/tags", () =>
        HttpResponse.json({ tags: [], cv: 3000 }),
      ),
    );
    const { stats, provider } = countingProvider();
    const client = createApiClient({ accessToken: "flush-disarm-token", cache: { provider } });

    await client.get("v2/cdn/stories", { query: { version: "published" } });
    await client.spaces.get(); // arms an ambiguous sighting
    await client.flushCache(); // e.g. a webhook: this already answers it
    expect(stats.flushes).toBe(1);

    await client.get("v2/cdn/tags", { query: { version: "published" } });
    expect(stats.flushes).toBe(1);
  });
  it("should let one concurrent request settle the sighting", async () => {
    // One settle for the whole batch. A flush per sibling would each drop what the
    // earlier ones had just stored, so those entries come back empty on the next read.
    const { stats, provider } = countingProvider();
    // Staggered so a later sibling's flush would land after an earlier one stored its
    // entry.
    const delays: Record<string, number> = { a: 5, b: 15, c: 25, d: 35 };
    const linkRequests: Record<string, number> = {};
    let cv = 1000;
    server.use(
      spaceHandler(() => 2000),
      http.get("https://api.storyblok.com/v2/cdn/links", async ({ request }) => {
        const startsWith = new URL(request.url).searchParams.get("starts_with") ?? "root";
        linkRequests[startsWith] = (linkRequests[startsWith] ?? 0) + 1;
        await new Promise((resolve) => setTimeout(resolve, delays[startsWith] ?? 0));
        return HttpResponse.json({ links: {}, cv });
      }),
    );
    const client = createApiClient({ accessToken: "concurrent-token", cache: { provider } });

    await client.get("v2/cdn/links", { query: { version: "published" } });
    await client.spaces.get(); // ambiguous: the cv does not match the space version

    cv = 2000; // the revalidation finds a cv that moved, so the cache is emptied once
    const keys = ["a", "b", "c", "d"];
    await Promise.all(
      keys.map((startsWith) =>
        client.get("v2/cdn/links", { query: { version: "published", starts_with: startsWith } }),
      ),
    );

    expect(stats.flushes).toBe(1);

    // Every sibling's entry survived, so a second read of all of them hits the cache.
    const requestsBefore = { ...linkRequests };
    await Promise.all(
      keys.map((startsWith) =>
        client.get("v2/cdn/links", { query: { version: "published", starts_with: startsWith } }),
      ),
    );

    expect(linkRequests).toEqual(requestsBefore);
  });

  it("should keep serving concurrent cache hits while the sighting is settled", async () => {
    // The settle needs the network; the requests behind it do not. Once it has stored
    // its response, the siblings sharing its key are cache hits again.
    let linkRequests = 0;
    let cv = 1000;
    server.use(
      spaceHandler(() => 2000),
      http.get("https://api.storyblok.com/v2/cdn/links", async () => {
        linkRequests++;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return HttpResponse.json({ links: {}, cv });
      }),
    );
    const client = createApiClient({ accessToken: "concurrent-hit-token" });

    await client.get("v2/cdn/links", { query: { version: "published" } });
    await client.spaces.get();
    expect(linkRequests).toBe(1);

    cv = 2000;
    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        client.get("v2/cdn/links", { query: { version: "published" } }),
      ),
    );

    expect(linkRequests).toBe(2); // one settle, five cache hits
    // Every sibling carries the response the settle stored, not the entry its flush
    // dropped — a request count alone cannot tell those two apart.
    expect(results.map((result) => result.data)).toEqual(
      Array.from({ length: 6 }, () => ({ links: {}, cv: 2000 })),
    );
  });

  it("should not retry a failed settle once per concurrent sibling", async () => {
    // A waiter must not take over a settle that failed, or one dead request becomes a
    // chain of them.
    let linkRequests = 0;
    let failing = false;
    server.use(
      spaceHandler(() => 2000),
      http.get("https://api.storyblok.com/v2/cdn/links", async () => {
        linkRequests++;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return failing
          ? new HttpResponse(null, { status: 500 })
          : HttpResponse.json({ links: {}, cv: 1000 });
      }),
    );
    const client = createApiClient({ accessToken: "failed-settle-token", retry: { limit: 0 } });

    await client.get("v2/cdn/links", { query: { version: "published" } });
    await client.spaces.get();

    failing = true;
    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        client.get("v2/cdn/links", { query: { version: "published" } }),
      ),
    );

    expect(linkRequests).toBe(2); // one attempt for the batch, not one per sibling
    expect(results.every((result) => result.error === undefined)).toBe(true);

    // The signal is still pending, so a later request retries it.
    failing = false;
    await client.get("v2/cdn/links", { query: { version: "published" } });
    expect(linkRequests).toBe(3);
  });

  it("should not make a poll wait for the settle it triggered", async () => {
    // `/cdn/spaces/me` is not cacheable and so never waits: a poll stuck behind a
    // content request would stall the interval driving it.
    const order: string[] = [];
    server.use(
      spaceHandler(() => 2000),
      http.get("https://api.storyblok.com/v2/cdn/links", async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return HttpResponse.json({ links: {}, cv: 1000 });
      }),
    );
    const client = createApiClient({ accessToken: "poll-not-blocked-token" });

    await client.get("v2/cdn/links", { query: { version: "published" } });
    await client.spaces.get();

    const settling = client
      .get("v2/cdn/links", { query: { version: "published", starts_with: "blog" } })
      .then(() => order.push("settle"));
    await new Promise((resolve) => setTimeout(resolve, 5));
    await client.spaces.get();
    order.push("poll");
    await settling;

    expect(order).toEqual(["poll", "settle"]);
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
