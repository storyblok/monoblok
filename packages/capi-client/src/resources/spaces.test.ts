import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { createApiClient } from "../index";
import { createMemoryCacheProvider } from "../utils/cache";
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
  // `/cdn/spaces/me` reports the raw space `version` and no `cv`.
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

  /** Counts flushes, to tell invalidation (entries unreadable) from a flush (entries gone). */
  const countingProvider = () => {
    const store = new Map<string, CacheEntry>();
    const stats = { flushes: 0 };
    const provider: CacheProvider = {
      // The store is heterogeneous; the caller names the expected type via the generic.
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
    /** Response entries, without the version watermark record. */
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
    await client.get("v2/cdn/stories", { query: { version: "published" } });
    expect(storyRequests).toBe(1);

    // The cv matches the space version, so nothing was published.
    await client.spaces.get();
    await client.spaces.get();
    await client.get("v2/cdn/stories", { query: { version: "published" } });
    expect(storyRequests).toBe(1);

    spaceVersion = 2000; // content was published
    await client.spaces.get();
    await client.get("v2/cdn/stories", { query: { version: "published" } });

    expect(storyRequests).toBe(2);
  });

  it("should not flush the provider when it notices a publish", async () => {
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

    spaceVersion = 3000;
    await client.get("v2/cdn/stories", { query: { version: "published", starts_with: "blog" } });
    expect(storyRequests).toBe(2);

    await client.get("v2/cdn/stories", { query: { version: "published" } });

    expect(storyRequests).toBe(2);
  });

  it("should ignore a space version that moved backwards", async () => {
    // `/cdn/spaces/me` is edge-cached per POP, so a lagging node can answer a poll.
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
    await client.spaces.get();
    expect(storyRequests).toBe(1);

    spaceVersion = 1000; // a stale edge node answers
    await client.spaces.get();
    await client.get("v2/cdn/stories", { query: { version: "published" } });
    expect(storyRequests).toBe(1);

    spaceVersion = 2000;
    await client.spaces.get();
    await client.get("v2/cdn/stories", { query: { version: "published" } });
    expect(storyRequests).toBe(1);
  });

  it("should not attach a cv to the poll request", async () => {
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
    // A cv below the space version is either a publish or a Minimum Cache TTL flooring it.
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

    await client.spaces.get();
    await client.get("v2/cdn/stories", { query: { version: "published" } });
    expect(storyRequests).toBe(2);
  });

  it("should send the request that follows a publish without a cv", async () => {
    // The edge serves `?cv=<old>` for up to a week; without a cv the origin redirects to
    // the current one.
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
    expect(new URL(storyUrls[0]).searchParams.get("cv")).toBeNull();

    spaceVersion = 2000; // content was published
    await client.spaces.get();
    await client.get("v2/cdn/stories", { query: { version: "published" } });

    const lastUrl = storyUrls[storyUrls.length - 1];
    expect(new URL(lastUrl).searchParams.get("cv")).toBeNull();
  });

  it("should keep every other cached entry when the cv is unchanged", async () => {
    // A Minimum Cache TTL floors the cv, so it never matches the raw space version.
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
    await client.get("v2/cdn/stories", { query: { version: "published" } });

    await client.get("v2/cdn/tags", { query: { version: "published" } });
    expect(tagRequests).toBe(1);
  });

  it("should invalidate entries of endpoints that report no cv", async () => {
    // `/cdn/tags` responses carry no cv of their own.
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
    let storyCv = 1000;
    const storyUrls: string[] = [];
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories", ({ request }) => {
        storyUrls.push(request.url);
        return HttpResponse.json({ stories: [], cv: storyCv });
      }),
    );
    const client = createApiClient({ accessToken: "stale-edge-token" });

    await client.get("v2/cdn/stories", { query: { version: "published" } });

    storyCv = 900; // a stale edge node answers
    await client.get("v2/cdn/stories", { query: { version: "published", starts_with: "blog" } });

    await client.get("v2/cdn/stories", { query: { version: "published", starts_with: "blog" } });
    expect(storyUrls).toHaveLength(3);

    expect(new URL(storyUrls[storyUrls.length - 1]).searchParams.get("cv")).toBe("1000");
  });

  it("should ignore a lower cv reported by a stale edge node after a publish", async () => {
    let spaceVersion = 1000;
    let storyCv = 1000;
    const storyUrls: string[] = [];
    server.use(
      spaceHandler(() => spaceVersion),
      http.get("https://api.storyblok.com/v2/cdn/stories", ({ request }) => {
        storyUrls.push(request.url);
        return HttpResponse.json({ stories: [], cv: storyCv });
      }),
    );
    const client = createApiClient({ accessToken: "stale-edge-after-publish-token" });

    await client.get("v2/cdn/stories", { query: { version: "published" } });
    await client.spaces.get();

    spaceVersion = 2000; // content was published
    await client.spaces.get();

    storyCv = 900; // a stale edge node answers
    await client.get("v2/cdn/stories", { query: { version: "published" } });
    await client.get("v2/cdn/stories", { query: { version: "published" } });

    expect(storyUrls).toHaveLength(3);
    expect(new URL(storyUrls[storyUrls.length - 1]).searchParams.get("cv")).toBeNull();
  });

  it("should invalidate published entries when a draft response reports a new cv", async () => {
    // Draft responses report the same cv as published ones.
    let cv = 1000;
    let publishedRequests = 0;
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories", ({ request }) => {
        const version = new URL(request.url).searchParams.get("version");
        if (version !== "draft") {
          publishedRequests++;
        }
        return HttpResponse.json({ stories: [], cv });
      }),
    );
    const client = createApiClient({ accessToken: "draft-signal-token" });

    await client.get("v2/cdn/stories", { query: { version: "published" } });
    await client.get("v2/cdn/stories", { query: { version: "published" } });
    expect(publishedRequests).toBe(1);

    cv = 2000; // content was published
    await client.get("v2/cdn/stories", { query: { version: "draft" } });
    await client.get("v2/cdn/stories", { query: { version: "published" } });

    expect(publishedRequests).toBe(2);
  });

  it("should not let a draft in flight across a publish re-pin the cv it dropped", async () => {
    // A draft that left before the publish reports the pre-publish cv.
    const gate = deferred();
    let spaceVersion = 1000;
    const publishedCvs: Array<string | null> = [];
    server.use(
      spaceHandler(() => spaceVersion),
      http.get("https://api.storyblok.com/v2/cdn/stories", async ({ request }) => {
        const params = new URL(request.url).searchParams;
        if (params.get("version") === "draft") {
          await gate.promise;
        } else {
          publishedCvs.push(params.get("cv"));
        }
        return HttpResponse.json({ stories: [], cv: 1000 });
      }),
    );
    const client = createApiClient({ accessToken: "draft-inflight-publish-token" });

    await client.get("v2/cdn/stories", { query: { version: "published" } });
    await client.spaces.get();

    const draft = client.get("v2/cdn/stories", { query: { version: "draft" } });
    await new Promise((resolve) => setTimeout(resolve, 10));
    spaceVersion = 2000; // content was published
    await client.spaces.get();
    gate.resolve();
    await draft;

    await client.get("v2/cdn/stories", { query: { version: "published", page: "2" } });
    expect(publishedCvs).toEqual([null, null]);
  });

  it("should not let a draft in flight across flushCache re-pin the cv it dropped", async () => {
    const gate = deferred();
    const publishedCvs: Array<string | null> = [];
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories", async ({ request }) => {
        const params = new URL(request.url).searchParams;
        if (params.get("version") === "draft") {
          await gate.promise;
        } else {
          publishedCvs.push(params.get("cv"));
        }
        return HttpResponse.json({ stories: [], cv: 1000 });
      }),
    );
    const client = createApiClient({
      accessToken: "draft-inflight-flush-token",
      cache: { flush: "manual" },
    });

    await client.get("v2/cdn/stories", { query: { version: "published" } });

    const draft = client.get("v2/cdn/stories", { query: { version: "draft" } });
    await new Promise((resolve) => setTimeout(resolve, 10));
    await client.flushCache();
    gate.resolve();
    await draft;

    await client.get("v2/cdn/stories", { query: { version: "published", page: "2" } });
    expect(publishedCvs).toEqual([null, null]);
  });

  it("should not let a response issued while no cv was known re-teach it after a later publish", async () => {
    const gate = deferred();
    const titles: Record<number, string> = { 1000: "v1" };
    let currentCv = 1000;
    let spaceVersion = 1000;
    server.use(
      spaceHandler(() => spaceVersion),
      http.get("https://api.storyblok.com/v2/cdn/stories/:slug", async ({ request, params }) => {
        // The edge serves a held `cv` from that snapshot and redirects a missing one to the
        // current version.
        const requested = Number(new URL(request.url).searchParams.get("cv")) || currentCv;
        if (params.slug === "about") {
          await gate.promise;
        }
        return HttpResponse.json({ story: { name: titles[requested] }, cv: requested });
      }),
    );
    const client = createApiClient({ accessToken: "unknown-cv-reteach-token" });
    const readHome = async () => {
      const { data } = await client.get("v2/cdn/stories/home", {
        query: { version: "published" },
      });
      return (data as { story: { name: string } }).story.name;
    };
    const publish = (cv: number, title: string) => {
      titles[cv] = title;
      currentCv = cv;
      spaceVersion = cv;
    };

    await readHome();
    await client.spaces.get();
    publish(2000, "v2");
    await client.spaces.get();

    const about = client.get("v2/cdn/stories/about", { query: { version: "published" } });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(await readHome()).toBe("v2");
    publish(3000, "v3");
    await client.spaces.get();
    gate.resolve();
    await about;

    expect(await readHome()).toBe("v3");
  });

  it("should cache content read in parallel with the first poll", async () => {
    // A cold start renders and polls at once.
    let storyRequests = 0;
    server.use(
      spaceHandler(() => 1000),
      http.get("https://api.storyblok.com/v2/cdn/stories/:slug", () => {
        storyRequests++;
        return HttpResponse.json({ story: {}, cv: 1000 });
      }),
    );
    const client = createApiClient({ accessToken: "cold-start-poll-token" });
    const readAll = () =>
      Promise.all(
        ["a", "b", "c"].map((slug) =>
          client.get(`v2/cdn/stories/${slug}`, { query: { version: "published" } }),
        ),
      );

    await Promise.all([client.spaces.get(), readAll()]);
    await readAll();

    expect(storyRequests).toBe(3);
  });

  it("should answer draft requests and polls when the cache provider fails", async () => {
    server.use(
      spaceHandler(() => 1000),
      http.get("https://api.storyblok.com/v2/cdn/stories", () =>
        HttpResponse.json({ stories: [], cv: 1000 }),
      ),
    );
    const failingProvider: CacheProvider = {
      get: async () => {
        throw new Error("provider unavailable");
      },
      set: async () => {
        throw new Error("provider unavailable");
      },
      flush: async () => {},
    };
    const client = createApiClient({
      accessToken: "failing-provider-token",
      cache: { provider: failingProvider },
    });

    const draft = await client.get("v2/cdn/stories", { query: { version: "draft" } });
    const poll = await client.spaces.get();

    expect(draft.error).toBeUndefined();
    expect(poll.error).toBeUndefined();
  });

  it("should not treat a zero cv as pinned by the caller", async () => {
    // `storyblok-js-client` sends `cv: 0` for "no version known".
    let cv = 1000;
    const storyUrls: string[] = [];
    server.use(
      spaceHandler(() => cv),
      http.get("https://api.storyblok.com/v2/cdn/stories", ({ request }) => {
        storyUrls.push(request.url);
        return HttpResponse.json({ stories: [], cv });
      }),
    );
    const client = createApiClient({ accessToken: "zero-cv-token" });

    await client.get("v2/cdn/stories", { query: { version: "published", cv: 0 } });
    expect(new URL(storyUrls[0]).searchParams.get("cv")).toBeNull();

    await client.get("v2/cdn/stories", { query: { version: "published", cv: 0 } });
    expect(storyUrls).toHaveLength(1);

    cv = 2000; // content was published
    await client.spaces.get();
    await client.get("v2/cdn/stories", { query: { version: "published", cv: 0 } });

    expect(storyUrls).toHaveLength(2);
  });

  it("should not write away a flushCache it did not see", async () => {
    // The watermark record is read, merged and written back without a lock.
    let watermarkReads = 0;
    let storyRequests = 0;
    let flushBeforeWrite: (() => Promise<void>) | undefined;
    const { provider } = countingProvider();
    const racingProvider: CacheProvider = {
      ...provider,
      get: async <TValue = unknown>(key: string) => {
        const entry = await provider.get<TValue>(key);
        // The second record read precedes this response's write, so the flush lands between.
        if (key.startsWith("sb:versions:") && ++watermarkReads === 2 && flushBeforeWrite) {
          const flush = flushBeforeWrite;
          flushBeforeWrite = undefined;
          await flush();
        }
        return entry;
      },
    };
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories", () => {
        storyRequests++;
        return HttpResponse.json({ stories: [], cv: 1000 });
      }),
    );
    const client = createApiClient({
      accessToken: "watermark-race-token",
      cache: { provider: racingProvider },
    });
    flushBeforeWrite = () => client.flushCache();

    await client.get("v2/cdn/stories", { query: { version: "published" } });
    await client.get("v2/cdn/stories", { query: { version: "published" } });

    expect(storyRequests).toBe(2);
  });

  it("should not write a record back over a flush that deleted it", async () => {
    let watermarkReads = 0;
    let storyRequests = 0;
    let flushDuringRead: (() => Promise<void>) | undefined;
    const { store, provider } = countingProvider();
    const racingProvider: CacheProvider = {
      ...provider,
      get: async <TValue = unknown>(key: string) => {
        // Lands after `flush()` deleted the record and before it is rewritten.
        if (key.startsWith("sb:versions:") && ++watermarkReads === 2 && flushDuringRead) {
          const flush = flushDuringRead;
          flushDuringRead = undefined;
          await flush();
        }
        return provider.get<TValue>(key);
      },
    };
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories", () => {
        storyRequests++;
        return HttpResponse.json({ stories: [], cv: 1000 });
      }),
    );
    const client = createApiClient({
      accessToken: "watermark-deleted-token",
      cache: { provider: racingProvider },
    });
    flushDuringRead = () => client.flushCache();

    await client.get("v2/cdn/stories", { query: { version: "published" } });
    await client.get("v2/cdn/stories", { query: { version: "published" } });

    expect(storyRequests).toBe(2);
    const record = [...store.entries()].find(([key]) => key.startsWith("sb:versions:"));
    expect((record?.[1].value as { generation?: number }).generation).toBe(1);
  });

  it("should not cache a response that was in flight across an explicit flushCache", async () => {
    // A webhook-driven flush landing while a request without a known cv is in flight.
    const gate = deferred();
    let storyRequests = 0;
    const storyUrls: string[] = [];
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories", async ({ request }) => {
        storyRequests++;
        storyUrls.push(request.url);
        if (storyRequests === 1) {
          await gate.promise;
        }
        return HttpResponse.json({ stories: [], cv: 1000 });
      }),
    );
    const client = createApiClient({ accessToken: "flush-in-flight-token" });

    const inFlight = client.get("v2/cdn/stories", { query: { version: "published" } });
    await new Promise((resolve) => setTimeout(resolve, 10));

    await client.flushCache();
    gate.resolve();
    await inFlight;

    await client.get("v2/cdn/stories", { query: { version: "published" } });

    expect(storyRequests).toBe(2);
    expect(new URL(storyUrls[storyUrls.length - 1]).searchParams.get("cv")).toBeNull();
  });

  it("should not serve a response that was in flight when a publish was noticed", async () => {
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
    await client.spaces.get();

    const inFlight = client.get("v2/cdn/stories", { query: { version: "published", page: "2" } });
    await new Promise((resolve) => setTimeout(resolve, 10));

    spaceVersion = 2000; // content was published
    await client.spaces.get();
    gate.resolve();
    await inFlight;

    await client.get("v2/cdn/stories", { query: { version: "published", page: "2" } });
    expect(storyRequests).toBe(3);
  });

  it("should not let a cv-less response in flight refill the cache a publish invalidated", async () => {
    // `/cdn/links` responses carry no cv of their own.
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

    await client.get("v2/cdn/stories", { query: { version: "published" } });

    const linksRequest = client.get("v2/cdn/links", { query: { version: "published" } });

    storyCv = 2000; // content was published
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
    await client.spaces.get();
    for (let i = 0; i < 3; i++) {
      await client.spaces.get();
      await client.get("v2/cdn/stories", { query: { version: "published" } });
    }

    expect(storyRequests).toBe(1);
  });

  it("should not invalidate when a Minimum Cache TTL floors the cv", async () => {
    // A Minimum Cache TTL floors the cv, so it never matches the raw space version.
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
    // Without a cv on the request, an edge cache can keep reporting a stale cv.
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
    await client.spaces.get();
    await client.get("v2/cdn/stories", { query: { version: "published" } });
    expect(storyUrls).toHaveLength(1);

    spaceVersion = 2000; // content was published
    await client.spaces.get();
    await client.get("v2/cdn/stories", { query: { version: "published" } });
    expect(storyUrls).toHaveLength(2);

    expect(storyUrls.every((url) => !url.includes("cv="))).toBe(true);
  });

  it("should invalidate an ambiguous first sighting when cv is manual", async () => {
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

  it("should flush the cache even when the version record can't be read", async () => {
    const provider = createMemoryCacheProvider();
    let isGetFailing = false;
    const flakyProvider: CacheProvider = {
      ...provider,
      get: (key) => (isGetFailing ? Promise.reject(new Error("unavailable")) : provider.get(key)),
    };
    let storyRequests = 0;
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories", () => {
        storyRequests++;
        return HttpResponse.json({ stories: [], cv: 1000 });
      }),
    );
    const client = createApiClient({
      accessToken: "flush-get-fails-token",
      cache: { provider: flakyProvider, flush: "manual" },
    });

    await client.get("v2/cdn/stories", { query: { version: "published" } });
    isGetFailing = true;
    await client.flushCache();
    isGetFailing = false;
    await client.get("v2/cdn/stories", { query: { version: "published" } });

    expect(storyRequests).toBe(2);
  });

  it("should reset the tracked versions on an explicit flushCache", async () => {
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
    expect(storyUrls).toHaveLength(1);

    await client.get("v2/cdn/stories", { query: { version: "published" } });
    expect(new URL(storyUrls[1]).searchParams.get("cv")).toBeNull();

    spaceVersion = 3000; // content was published
    await client.spaces.get();
    await client.get("v2/cdn/stories", { query: { version: "published", cv: 900 } });

    expect(storyUrls).toHaveLength(2);
  });

  it("should cache a caller-pinned cv that the space has already moved past", async () => {
    const storyUrls: string[] = [];
    server.use(
      spaceHandler(() => 2000),
      http.get("https://api.storyblok.com/v2/cdn/stories", ({ request }) => {
        storyUrls.push(request.url);
        const cv = new URL(request.url).searchParams.get("cv");
        // The edge still holds the pinned snapshot, so it serves it rather than redirecting.
        return HttpResponse.json({ stories: [], cv: cv ? Number(cv) : 2000 });
      }),
    );
    const client = createApiClient({ accessToken: "pinned-below-known-token" });

    // Learn a cv first, so the pinned one below it looks like a stale read.
    await client.get("v2/cdn/stories", { query: { version: "published" } });
    expect(storyUrls).toHaveLength(1);

    await client.get("v2/cdn/stories", { query: { version: "published", cv: 900 } });
    await client.get("v2/cdn/stories", { query: { version: "published", cv: 900 } });

    expect(storyUrls).toHaveLength(2);
    expect(new URL(storyUrls[1]).searchParams.get("cv")).toBe("900");
  });

  it("should track the current cv a cache-busting cv was redirected to", async () => {
    // The edge redirects a cv it does not hold to the current version.
    let currentCv = 1000;
    const storyUrls: string[] = [];
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories", ({ request }) => {
        storyUrls.push(request.url);
        const requestedCv = Number(new URL(request.url).searchParams.get("cv"));
        const cv = requestedCv === 1000 ? 1000 : currentCv;
        return HttpResponse.json({ stories: [{ name: `v${cv}` }], cv });
      }),
    );
    const client = createApiClient({ accessToken: "cache-bust-token" });

    await client.get("v2/cdn/stories", { query: { version: "published" } });
    currentCv = 2000; // content was published
    const busted = await client.get("v2/cdn/stories", {
      query: { version: "published", cv: 9_999_999_999 },
    });
    const next = await client.get("v2/cdn/stories", { query: { version: "published" } });

    expect(busted.data).toMatchObject({ cv: 2000 });
    expect(next.data).toMatchObject({ cv: 2000 });
    expect(new URL(storyUrls[storyUrls.length - 1]).searchParams.get("cv")).toBe("2000");
  });

  it("should keep a response that reports the cv which superseded it", async () => {
    let releaseSlow: () => void = () => {};
    const slow = new Promise<void>((resolve) => (releaseSlow = resolve));
    let currentCv = 1000;
    let slowRequests = 0;
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories", () =>
        HttpResponse.json({ stories: [], cv: currentCv }),
      ),
      http.get("https://api.storyblok.com/v2/cdn/links", async () => {
        slowRequests++;
        await slow;
        return HttpResponse.json({ links: {}, cv: currentCv });
      }),
    );
    const client = createApiClient({ accessToken: "superseded-but-current-token" });

    await client.get("v2/cdn/stories", { query: { version: "published" } });

    const inFlight = client.get("v2/cdn/links", { query: { version: "published" } });
    currentCv = 2000; // published while that request is in flight
    await client.get("v2/cdn/stories", { query: { version: "published", page: "2" } });
    releaseSlow();
    await inFlight;

    await client.get("v2/cdn/links", { query: { version: "published" } });
    expect(slowRequests).toBe(1);
  });

  it("should never put a zero cv on the wire", async () => {
    const storyUrls: string[] = [];
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories", ({ request }) => {
        storyUrls.push(request.url);
        return HttpResponse.json({ stories: [], cv: 0 });
      }),
    );
    const client = createApiClient({ accessToken: "zero-cv-token" });

    await client.get("v2/cdn/stories", { query: { version: "published" } });
    await client.get("v2/cdn/stories", { query: { version: "published", page: "2" } });

    expect(storyUrls).toHaveLength(2);
    for (const url of storyUrls) {
      expect(new URL(url).searchParams.get("cv")).toBeNull();
    }
  });

  it("should keep the invalidation in place when the refetch after a publish fails", async () => {
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
    // A Minimum Cache TTL floors the cv, so it never matches the raw space version.
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

    // The first client's request plus one refetch to settle its ambiguous first sighting.
    expect(storyRequests).toBe(2);
    expect(responseKeys()).toHaveLength(1);
  });

  it("should let a per-request client inherit a publish another one noticed", async () => {
    // A fresh client per request sharing one provider, as in serverless.
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
    await newClient().spaces.get();
    await newClient().get("v2/cdn/stories", { query: { version: "published" } });
    expect(storyRequests).toBe(1);

    spaceVersion = 2000; // content was published
    await newClient().spaces.get();
    await newClient().get("v2/cdn/stories", { query: { version: "published" } });

    expect(storyRequests).toBe(2);
  });

  it("should refetch when the watermark record is gone but the entry is not", async () => {
    // Simulates a provider evicting the watermark record but not the entry.
    let storyRequests = 0;
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories", () => {
        storyRequests++;
        return HttpResponse.json({ stories: [], cv: 1000 });
      }),
    );
    const { store, provider } = countingProvider();
    const client = createApiClient({ accessToken: "lost-record-token", cache: { provider } });

    await client.get("v2/cdn/stories", { query: { version: "published" } });
    await client.get("v2/cdn/stories", { query: { version: "published" } });
    expect(storyRequests).toBe(1);

    for (const key of store.keys()) {
      if (key.startsWith("sb:versions:")) {
        store.delete(key);
      }
    }

    await client.get("v2/cdn/stories", { query: { version: "published" } });
    expect(storyRequests).toBe(2);

    await client.get("v2/cdn/stories", { query: { version: "published" } });
    expect(storyRequests).toBe(2);
  });

  it("should not serve one space's content to a client for another", async () => {
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories", ({ request }) => {
        const token = new URL(request.url).searchParams.get("token");
        return HttpResponse.json({ stories: [], cv: 1000, space: token });
      }),
    );
    const { provider } = countingProvider();
    const first = createApiClient({ accessToken: "space-one", cache: { provider } });
    const second = createApiClient({ accessToken: "space-two", cache: { provider } });

    const firstResult = await first.get("v2/cdn/stories", { query: { version: "published" } });
    const secondResult = await second.get("v2/cdn/stories", { query: { version: "published" } });

    expect((firstResult.data as { space: string }).space).toBe("space-one");
    expect((secondResult.data as { space: string }).space).toBe("space-two");
  });

  it("should not serve another client's in-flight pre-publish response", async () => {
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
