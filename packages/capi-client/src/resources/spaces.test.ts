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
   * A `Map`-backed provider that also reports how many times it was flushed, so a test
   * can tell invalidation (entries stop being readable) from a flush (entries are gone).
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
    /** The response entries, without the reserved record holding the version watermarks. */
    const responseKeys = () => [...store.keys()].filter((key) => !key.startsWith("sb:versions:"));
    return { store, stats, provider, responseKeys };
  };

  /** A promise plus its resolver, to hold a response in flight across another request. */
  const deferred = () => {
    let resolve!: () => void;
    const promise = new Promise<void>((settle) => {
      resolve = settle;
    });
    return { promise, resolve };
  };

  it("should invalidate cached entries when the space reports a new version", async () => {
    let spaceVersion = 1000;
    let storyRequests = 0;
    server.use(
      spaceHandler(() => spaceVersion),
      http.get("https://api.storyblok.com/v2/cdn/stories", () => {
        storyRequests++;
        return HttpResponse.json({ stories: [], cv: 1000 });
      }),
    );
    const client = createApiClient({ accessToken: "test-token" });

    await client.get("v2/cdn/stories", { query: { version: "published" } });
    await client.get("v2/cdn/stories", { query: { version: "published" } }); // cached
    expect(storyRequests).toBe(1);

    // First poll: the cv already matches this space version, so nothing was published in
    // between and the cached entry stays valid.
    await client.spaces.get();
    await client.spaces.get();
    await client.get("v2/cdn/stories", { query: { version: "published" } });
    expect(storyRequests).toBe(1);

    spaceVersion = 2000; // content was published
    await client.spaces.get();
    await client.get("v2/cdn/stories", { query: { version: "published" } });

    expect(storyRequests).toBe(2); // the entry is no longer readable, content re-fetched
  });

  it("should not flush the provider when it notices a publish", async () => {
    // Invalidation is by version mismatch, so entries for keys the client never touches
    // again — and entries other clients keep in a shared provider — are left alone to
    // expire by TTL.
    let spaceVersion = 1000;
    let storyRequests = 0;
    server.use(
      spaceHandler(() => spaceVersion),
      http.get("https://api.storyblok.com/v2/cdn/stories", () => {
        storyRequests++;
        return HttpResponse.json({ stories: [], cv: 1000 });
      }),
    );
    const { stats, provider } = countingProvider();
    const client = createApiClient({ accessToken: "no-flush-token", cache: { provider } });

    await client.get("v2/cdn/stories", { query: { version: "published" } });
    await client.spaces.get();

    spaceVersion = 2000;
    await client.spaces.get();
    await client.get("v2/cdn/stories", { query: { version: "published" } });

    expect(storyRequests).toBe(2);
    expect(stats.flushes).toBe(0);
  });

  it("should ignore a space.version reported by another endpoint", async () => {
    // Gated on the path, not just the response shape: a `space.version` embedded in a
    // content response must never invalidate anything.
    let spaceVersion = 2000;
    let storyRequests = 0;
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories", () => {
        storyRequests++;
        return HttpResponse.json({
          stories: [],
          cv: 1000,
          space: { id: 1, name: "Test Space", version: spaceVersion },
        });
      }),
    );
    const client = createApiClient({ accessToken: "test-token" });

    await client.get("v2/cdn/stories", { query: { version: "published" } });
    expect(storyRequests).toBe(1);

    // A second, differently keyed request reports a moved space version.
    spaceVersion = 3000;
    await client.get("v2/cdn/stories", { query: { version: "published", starts_with: "blog" } });
    expect(storyRequests).toBe(2);

    // Still cached: nothing reported a new cv, and a content response's `space.version`
    // is not a change signal.
    await client.get("v2/cdn/stories", { query: { version: "published" } });

    expect(storyRequests).toBe(2);
  });

  it("should ignore a space version that moved backwards", async () => {
    // `/cdn/spaces/me` is cached for two seconds per POP, so a poll can be answered by a
    // node that has not caught up. Only a version that moved FORWARD is a publish.
    let spaceVersion = 2000;
    let storyRequests = 0;
    server.use(
      spaceHandler(() => spaceVersion),
      http.get("https://api.storyblok.com/v2/cdn/stories", () => {
        storyRequests++;
        return HttpResponse.json({ stories: [], cv: 2000 });
      }),
    );
    const client = createApiClient({ accessToken: "regressing-version-token" });

    await client.get("v2/cdn/stories", { query: { version: "published" } });
    await client.spaces.get(); // records 2000
    expect(storyRequests).toBe(1);

    spaceVersion = 1000; // a stale edge node answers
    await client.spaces.get();
    await client.get("v2/cdn/stories", { query: { version: "published" } });
    expect(storyRequests).toBe(1); // no publish, still cached

    spaceVersion = 2000; // back to the version already recorded
    await client.spaces.get();
    await client.get("v2/cdn/stories", { query: { version: "published" } });
    expect(storyRequests).toBe(1); // the regression never moved the watermark
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
      http.get("https://api.storyblok.com/v2/cdn/stories", () => {
        return HttpResponse.json({ stories: [], cv: 1000 });
      }),
    );
    const client = createApiClient({ accessToken: "test-token" });

    await client.get("v2/cdn/stories", { query: { version: "published" } });
    await client.spaces.get();

    expect(spaceUrls).toHaveLength(1);
    expect(new URL(spaceUrls[0]).searchParams.has("cv")).toBe(false);
  });

  it("should treat a trailing-slash poll as the same signal", async () => {
    // The API serves `/cdn/spaces/me/` identically, and callers spell it both ways.
    let spaceVersion = 1000;
    let storyRequests = 0;
    server.use(
      spaceHandler(() => spaceVersion),
      http.get("https://api.storyblok.com/v2/cdn/spaces/me/", () =>
        HttpResponse.json({ space: { id: 1, name: "Test Space", version: spaceVersion } }),
      ),
      http.get("https://api.storyblok.com/v2/cdn/stories", () => {
        storyRequests++;
        return HttpResponse.json({ stories: [], cv: 1000 });
      }),
    );
    const client = createApiClient({ accessToken: "trailing-slash-token" });

    await client.get("v2/cdn/stories", { query: { version: "published" } });
    await client.get("v2/cdn/spaces/me/");
    expect(storyRequests).toBe(1);

    spaceVersion = 2000; // content was published
    await client.get("v2/cdn/spaces/me/");
    await client.get("v2/cdn/stories", { query: { version: "published" } });

    expect(storyRequests).toBe(2);
  });

  it("should refetch on the first poll when the cv does not match the space version", async () => {
    // A publish may have landed between the first content request and this poll, but so
    // could a Minimum Cache TTL flooring the cv. One cv-less refetch settles it.
    let storyRequests = 0;
    server.use(
      spaceHandler(() => 2000),
      http.get("https://api.storyblok.com/v2/cdn/stories", () => {
        storyRequests++;
        return HttpResponse.json({ stories: [], cv: 1000 });
      }),
    );
    const client = createApiClient({ accessToken: "test-token" });

    await client.get("v2/cdn/stories", { query: { version: "published" } });
    await client.spaces.get();
    await client.get("v2/cdn/stories", { query: { version: "published" } });
    expect(storyRequests).toBe(2);

    // …but only once: further polls at the same version must not refetch again.
    await client.spaces.get();
    await client.get("v2/cdn/stories", { query: { version: "published" } });
    expect(storyRequests).toBe(2);
  });

  it("should send the request that follows a publish without a cv", async () => {
    // The edge serves `?cv=<old>` for up to a week, so the refetch must not carry the cv
    // it was invalidated for; without one it takes the origin's redirect to the current.
    let spaceVersion = 1000;
    const storyUrls: string[] = [];
    server.use(
      spaceHandler(() => spaceVersion),
      http.get("https://api.storyblok.com/v2/cdn/stories", ({ request }) => {
        storyUrls.push(request.url);
        return HttpResponse.json({ stories: [], cv: spaceVersion });
      }),
    );
    const client = createApiClient({ accessToken: "test-token" });

    await client.get("v2/cdn/stories", { query: { version: "published" } });
    expect(new URL(storyUrls[0]).searchParams.get("cv")).toBeNull(); // nothing known yet

    spaceVersion = 2000; // content was published
    await client.spaces.get();
    await client.get("v2/cdn/stories", { query: { version: "published" } });

    const lastUrl = storyUrls[storyUrls.length - 1];
    expect(new URL(lastUrl).searchParams.get("cv")).toBeNull();
  });

  it("should keep every other cached entry when the cv is unchanged", async () => {
    // A Minimum Cache TTL floors the cv permanently, so every fresh client sees an
    // ambiguous pair. The refetch proves nothing was published; other keys survive.
    let tagRequests = 0;
    server.use(
      spaceHandler(() => 1786950860),
      http.get("https://api.storyblok.com/v2/cdn/stories", () =>
        HttpResponse.json({ stories: [], cv: 1786950000 }),
      ),
      http.get("https://api.storyblok.com/v2/cdn/tags", () => {
        tagRequests++;
        return HttpResponse.json({ tags: [] });
      }),
    );
    const client = createApiClient({ accessToken: "ttl-token" });

    await client.get("v2/cdn/stories", { query: { version: "published" } });
    await client.get("v2/cdn/tags", { query: { version: "published" } });
    expect(tagRequests).toBe(1);

    await client.spaces.get();
    await client.get("v2/cdn/stories", { query: { version: "published" } }); // refetches

    await client.get("v2/cdn/tags", { query: { version: "published" } });
    expect(tagRequests).toBe(1); // still cached, nothing was published
  });

  it("should invalidate entries of endpoints that report no cv", async () => {
    // `/cdn/tags` and `/cdn/links` report no cv of their own, so their entries are tagged
    // with the cv they were requested under and invalidate with everything else.
    let spaceVersion = 1000;
    let tagRequests = 0;
    server.use(
      spaceHandler(() => spaceVersion),
      http.get("https://api.storyblok.com/v2/cdn/stories", () =>
        HttpResponse.json({ stories: [], cv: 1000 }),
      ),
      http.get("https://api.storyblok.com/v2/cdn/tags", () => {
        tagRequests++;
        return HttpResponse.json({ tags: [] });
      }),
    );
    const client = createApiClient({ accessToken: "cv-less-endpoint-token" });

    await client.get("v2/cdn/stories", { query: { version: "published" } });
    await client.get("v2/cdn/tags", { query: { version: "published" } });
    await client.spaces.get();
    expect(tagRequests).toBe(1);

    spaceVersion = 2000; // content was published
    await client.spaces.get();
    await client.get("v2/cdn/tags", { query: { version: "published" } });

    expect(tagRequests).toBe(2);
  });

  it("should ignore a lower cv reported by a stale edge node", async () => {
    // An older edge object answering must not move the known cv backwards, and its
    // response must not be stored over the newer entry.
    let storyCv = 1000;
    const storyUrls: string[] = [];
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories", ({ request }) => {
        storyUrls.push(request.url);
        return HttpResponse.json({ stories: [], cv: storyCv });
      }),
    );
    const client = createApiClient({ accessToken: "stale-edge-token" });

    await client.get("v2/cdn/stories", { query: { version: "published" } }); // learns cv 1000

    storyCv = 900; // an older edge node answers a differently keyed request
    await client.get("v2/cdn/stories", { query: { version: "published", starts_with: "blog" } });

    // The stale response was not stored, so reading its key hits the network again.
    await client.get("v2/cdn/stories", { query: { version: "published", starts_with: "blog" } });
    expect(storyUrls).toHaveLength(3);

    // And the known cv never moved backwards.
    expect(new URL(storyUrls[storyUrls.length - 1]).searchParams.get("cv")).toBe("1000");
  });

  it("should not serve a response that was in flight when a publish was noticed", async () => {
    // A response that left before the publish was noticed carries the pre-publish content
    // and the cv that was just dropped. Storing it would make the published content
    // invisible for a full `ttlMs`.
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
    await client.spaces.get(); // noticed while that request is still out
    gate.resolve();
    await inFlight;

    await client.get("v2/cdn/stories", { query: { version: "published", page: "2" } });
    expect(storyRequests).toBe(3); // refetched rather than served from a refilled cache
  });

  it("should not let a cv-less response in flight refill the cache a publish invalidated", async () => {
    // `/cdn/links` and `/cdn/tags` report no cv, so nothing in their own response says
    // which version they belong to — the cv the request was issued under does.
    const gate = deferred();
    let linksRequests = 0;
    let storyCv = 1000;
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/links", async () => {
        linksRequests++;
        if (linksRequests === 1) {
          await gate.promise;
          return HttpResponse.json({ links: { a: { id: 1, slug: "pre-publish" } } });
        }
        return HttpResponse.json({ links: { a: { id: 1, slug: "post-publish" } } });
      }),
      http.get("https://api.storyblok.com/v2/cdn/stories", () =>
        HttpResponse.json({ stories: [], cv: storyCv }),
      ),
    );
    const client = createApiClient({ accessToken: "inflight-cv-flush-token" });

    await client.get("v2/cdn/stories", { query: { version: "published" } }); // learns cv 1000

    // The links request goes out for cv 1000 and is held there.
    const linksRequest = client.get("v2/cdn/links", { query: { version: "published" } });

    // A publish lands: the next content response reports a moved cv.
    storyCv = 2000;
    await client.get("v2/cdn/stories", { query: { version: "published", page: "2" } });

    gate.resolve();
    await linksRequest;

    const links = await client.get("v2/cdn/links", { query: { version: "published" } });
    expect((links.data as { links: Record<string, { slug: string }> }).links.a.slug).toBe(
      "post-publish",
    );
  });

  it("should not invalidate while the space version is unchanged", async () => {
    let storyRequests = 0;
    server.use(
      spaceHandler(() => 1000),
      http.get("https://api.storyblok.com/v2/cdn/stories", () => {
        storyRequests++;
        return HttpResponse.json({ stories: [], cv: 1000 });
      }),
    );
    const client = createApiClient({ accessToken: "test-token" });

    await client.get("v2/cdn/stories", { query: { version: "published" } });
    await client.spaces.get(); // cv already matches, nothing to invalidate
    for (let i = 0; i < 3; i++) {
      await client.spaces.get();
      await client.get("v2/cdn/stories", { query: { version: "published" } });
    }

    expect(storyRequests).toBe(1);
  });

  it("should not invalidate when a Minimum Cache TTL floors the cv", async () => {
    // A Minimum Cache TTL floors the cv into buckets while `space.version` reports the
    // raw version: they differ permanently and must never be compared to each other.
    const flooredCv = 1_786_950_000;
    const rawSpaceVersion = 1_786_950_860;
    let storyRequests = 0;
    server.use(
      spaceHandler(() => rawSpaceVersion),
      http.get("https://api.storyblok.com/v2/cdn/stories", () => {
        storyRequests++;
        return HttpResponse.json({ stories: [], cv: flooredCv });
      }),
    );
    const client = createApiClient({ accessToken: "test-token" });

    for (let i = 0; i < 3; i++) {
      await client.spaces.get();
      await client.get("v2/cdn/stories", { query: { version: "published" } });
    }

    expect(storyRequests).toBe(1);
  });

  it("should still invalidate on a space version change when cv is manual", async () => {
    // With `cv: 'manual'` the cv is tracked but never attached to requests, so behind an
    // edge cache a content response can keep carrying a stale cv indefinitely.
    // `space.version` is then the only signal left to notice that content changed.
    let spaceVersion = 1000;
    const storyUrls: string[] = [];
    server.use(
      spaceHandler(() => spaceVersion),
      http.get("https://api.storyblok.com/v2/cdn/stories", ({ request }) => {
        storyUrls.push(request.url);
        return HttpResponse.json({ stories: [], cv: 1000 });
      }),
    );
    const client = createApiClient({
      accessToken: "test-token",
      cache: { cv: "manual" },
    });

    await client.get("v2/cdn/stories", { query: { version: "published" } });
    await client.spaces.get(); // cv already matches, nothing to invalidate
    await client.get("v2/cdn/stories", { query: { version: "published" } });
    expect(storyUrls).toHaveLength(1); // still cached

    spaceVersion = 2000; // content was published
    await client.spaces.get();
    await client.get("v2/cdn/stories", { query: { version: "published" } });
    expect(storyUrls).toHaveLength(2); // invalidated, content re-fetched

    expect(storyUrls.every((url) => !url.includes("cv="))).toBe(true);
  });

  it("should invalidate an ambiguous first sighting when cv is manual", async () => {
    // The ambiguity is the same as under `cv: 'auto'`, and so is the answer: drop the
    // known cv and let the next read of each key prove itself against the origin.
    let tagRequests = 0;
    server.use(
      spaceHandler(() => 2000),
      http.get("https://api.storyblok.com/v2/cdn/stories", () =>
        HttpResponse.json({ stories: [], cv: 1000 }),
      ),
      http.get("https://api.storyblok.com/v2/cdn/tags", () => {
        tagRequests++;
        return HttpResponse.json({ tags: [] });
      }),
    );
    const { stats, provider } = countingProvider();
    const client = createApiClient({
      accessToken: "manual-cv-sighting-token",
      cache: { cv: "manual", provider },
    });

    await client.get("v2/cdn/stories", { query: { version: "published" } });
    await client.get("v2/cdn/tags", { query: { version: "published" } });
    expect(tagRequests).toBe(1);

    await client.spaces.get(); // ambiguous first sighting
    await client.get("v2/cdn/tags", { query: { version: "published" } });

    expect(tagRequests).toBe(2);
    expect(stats.flushes).toBe(0);
  });

  it("should not invalidate when polled before any content request", async () => {
    // Polling before the first content request is the recommended startup shape: there
    // is no cv and no cache yet, so there is nothing to invalidate.
    let storyRequests = 0;
    server.use(
      spaceHandler(() => 1000),
      http.get("https://api.storyblok.com/v2/cdn/stories", () => {
        storyRequests++;
        return HttpResponse.json({ stories: [], cv: 1000 });
      }),
    );
    const client = createApiClient({ accessToken: "test-token" });

    await client.spaces.get();
    await client.get("v2/cdn/stories", { query: { version: "published" } });
    await client.spaces.get();
    await client.get("v2/cdn/stories", { query: { version: "published" } });

    expect(storyRequests).toBe(1);
  });

  it("should ignore a space version that is not a number", async () => {
    let storyRequests = 0;
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/spaces/me", () =>
        HttpResponse.json({ space: { id: 1, name: "Test Space", version: "2000" } }),
      ),
      http.get("https://api.storyblok.com/v2/cdn/stories", () => {
        storyRequests++;
        return HttpResponse.json({ stories: [], cv: 1000 });
      }),
    );
    const client = createApiClient({ accessToken: "test-token" });

    await client.get("v2/cdn/stories", { query: { version: "published" } });
    await client.spaces.get();
    await client.spaces.get();
    await client.get("v2/cdn/stories", { query: { version: "published" } });

    expect(storyRequests).toBe(1);
  });

  it("should not auto-invalidate on a space version change when flush is manual", async () => {
    let spaceVersion = 1000;
    let storyRequests = 0;
    server.use(
      spaceHandler(() => spaceVersion),
      http.get("https://api.storyblok.com/v2/cdn/stories", () => {
        storyRequests++;
        return HttpResponse.json({ stories: [], cv: 1000 });
      }),
    );
    const client = createApiClient({
      accessToken: "test-token",
      cache: { flush: "manual" },
    });

    await client.get("v2/cdn/stories", { query: { version: "published" } });
    await client.spaces.get();
    spaceVersion = 2000;
    await client.spaces.get();
    await client.get("v2/cdn/stories", { query: { version: "published" } });

    expect(storyRequests).toBe(1);
  });

  it("should reset the tracked versions on an explicit flushCache", async () => {
    // The entries the watermarks described are gone, so the next request must not be
    // pinned to the cv they were served under.
    const storyUrls: string[] = [];
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories", ({ request }) => {
        storyUrls.push(request.url);
        return HttpResponse.json({ stories: [], cv: 1000 });
      }),
    );
    const client = createApiClient({
      accessToken: "flush-reset-token",
      cache: { flush: "manual" },
    });

    await client.get("v2/cdn/stories", { query: { version: "published" } });
    await client.get("v2/cdn/stories", { query: { version: "published", page: "2" } });
    expect(new URL(storyUrls[1]).searchParams.get("cv")).toBe("1000");

    await client.flushCache();
    await client.get("v2/cdn/stories", { query: { version: "published", page: "2" } });

    const lastUrl = storyUrls[storyUrls.length - 1];
    expect(new URL(lastUrl).searchParams.get("cv")).toBeNull();
  });

  it("should serve a caller-pinned cv from its own entry and never track it", async () => {
    // A caller asking for one snapshot gets that snapshot: it is keyed separately, it
    // survives a publish, and what it reports must not pin anyone else's requests to it.
    let spaceVersion = 2000;
    const storyUrls: string[] = [];
    server.use(
      spaceHandler(() => spaceVersion),
      http.get("https://api.storyblok.com/v2/cdn/stories", ({ request }) => {
        storyUrls.push(request.url);
        const cv = new URL(request.url).searchParams.get("cv");
        return HttpResponse.json({ stories: [], cv: cv ? Number(cv) : 2000 });
      }),
    );
    const client = createApiClient({ accessToken: "pinned-cv-token" });

    await client.get("v2/cdn/stories", { query: { version: "published", cv: 900 } });
    await client.get("v2/cdn/stories", { query: { version: "published", cv: 900 } });
    expect(storyUrls).toHaveLength(1); // cached under its own key

    // The pinned request taught nothing, so this one goes out without a cv.
    await client.get("v2/cdn/stories", { query: { version: "published" } });
    expect(new URL(storyUrls[1]).searchParams.get("cv")).toBeNull();

    spaceVersion = 3000; // content was published
    await client.spaces.get();
    await client.get("v2/cdn/stories", { query: { version: "published", cv: 900 } });

    expect(storyUrls).toHaveLength(2); // the pinned snapshot is immune to publishes
  });

  it("should keep the invalidation in place when the refetch after a publish fails", async () => {
    // Nothing consumes the signal but a successful response: a failed refetch leaves the
    // entry unreadable, so the next request tries again instead of serving stale content.
    let spaceVersion = 1000;
    let storiesFail = false;
    let storyRequests = 0;
    server.use(
      spaceHandler(() => spaceVersion),
      http.get("https://api.storyblok.com/v2/cdn/stories", () => {
        storyRequests++;
        return storiesFail
          ? HttpResponse.json({ error: "Server error" }, { status: 500 })
          : HttpResponse.json({ stories: [], cv: spaceVersion });
      }),
    );
    const client = createApiClient({ accessToken: "failed-refetch-token", retry: { limit: 0 } });

    await client.get("v2/cdn/stories", { query: { version: "published" } });
    await client.spaces.get();
    expect(storyRequests).toBe(1);

    spaceVersion = 2000; // content was published
    await client.spaces.get();

    storiesFail = true;
    const failed = await client.get("v2/cdn/stories", { query: { version: "published" } });
    expect(failed.error).toBeDefined();

    storiesFail = false;
    const recovered = await client.get("v2/cdn/stories", { query: { version: "published" } });
    expect(recovered.data).toEqual({ stories: [], cv: 2000 });
    expect(storyRequests).toBe(3);
  });

  it("should not make a poll wait for a content request", async () => {
    // `/cdn/spaces/me` is not cacheable and never coordinates with content requests: a
    // poll stuck behind one would stall the interval driving it.
    const order: string[] = [];
    server.use(
      spaceHandler(() => 2000),
      http.get("https://api.storyblok.com/v2/cdn/stories", async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return HttpResponse.json({ stories: [], cv: 1000 });
      }),
    );
    const client = createApiClient({ accessToken: "poll-not-blocked-token" });

    await client.get("v2/cdn/stories", { query: { version: "published" } });
    await client.spaces.get();

    const content = client
      .get("v2/cdn/stories", { query: { version: "published", starts_with: "blog" } })
      .then(() => order.push("content"));
    await new Promise((resolve) => setTimeout(resolve, 5));
    await client.spaces.get();
    order.push("poll");
    await content;

    expect(order).toEqual(["poll", "content"]);
  });

  it("should cost one refetch per shared provider, not per client instance", async () => {
    // With a shared provider and a TTL-floored cv, every new client would see the same
    // ambiguous first sighting — but the watermarks live in the provider, so the second
    // client inherits the answer the first one paid for.
    let storyRequests = 0;
    server.use(
      spaceHandler(() => 1786950860),
      http.get("https://api.storyblok.com/v2/cdn/stories", () => {
        storyRequests++;
        return HttpResponse.json({ stories: [], cv: 1786950000 });
      }),
    );
    const { responseKeys, provider: sharedProvider } = countingProvider();

    // One client per request, as in SSR or serverless.
    for (let i = 0; i < 3; i++) {
      const client = createApiClient({
        accessToken: "ttl-token",
        cache: { provider: sharedProvider, ttlMs: 3_600_000 },
      });
      await client.get("v2/cdn/stories", { query: { version: "published" } });
      await client.spaces.get();
    }

    // One request for the first client, one to settle its ambiguous first sighting; the
    // clients after it read the entry that refetch stored.
    expect(storyRequests).toBe(2);
    expect(responseKeys()).toHaveLength(1);
  });

  it("should let a per-request client inherit a publish another one noticed", async () => {
    // The shape a serverless deployment has: a fresh client per request, one shared
    // provider, and a poll that has to invalidate content the *next* client reads.
    let spaceVersion = 1000;
    let storyRequests = 0;
    server.use(
      spaceHandler(() => spaceVersion),
      http.get("https://api.storyblok.com/v2/cdn/stories", () => {
        storyRequests++;
        return HttpResponse.json({ stories: [], cv: 1000 });
      }),
    );
    const { provider } = countingProvider();
    const newClient = () =>
      createApiClient({
        accessToken: "serverless-token",
        cache: { provider, ttlMs: 3_600_000 },
      });

    await newClient().get("v2/cdn/stories", { query: { version: "published" } });
    await newClient().spaces.get(); // records the baseline
    await newClient().get("v2/cdn/stories", { query: { version: "published" } });
    expect(storyRequests).toBe(1); // served from the shared provider

    spaceVersion = 2000; // content was published
    await newClient().spaces.get(); // a different client notices it
    await newClient().get("v2/cdn/stories", { query: { version: "published" } });

    expect(storyRequests).toBe(2);
  });

  it("should not serve another client's in-flight pre-publish response", async () => {
    // Two clients, one provider: the entry carries the cv it was served under, so the
    // client that stored it does not have to be the one that notices the publish.
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
    const { provider } = countingProvider();
    const clientA = createApiClient({ accessToken: "cross-client-token", cache: { provider } });
    const clientB = createApiClient({ accessToken: "cross-client-token", cache: { provider } });

    await clientA.get("v2/cdn/stories", { query: { version: "published" } });
    await clientA.spaces.get();

    const inFlight = clientB.get("v2/cdn/stories", { query: { version: "published", page: "2" } });
    await new Promise((resolve) => setTimeout(resolve, 10));

    spaceVersion = 2000; // content was published
    await clientA.spaces.get(); // only client A sees the signal
    gate.resolve();
    await inFlight;

    await clientA.get("v2/cdn/stories", { query: { version: "published", page: "2" } });
    expect(storyRequests).toBe(3);
  });
});
