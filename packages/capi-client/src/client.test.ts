import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
} from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { createApiClient, type HttpRequestOptions } from "./client";
import { ClientError } from "./error";
import type { CacheEntry, CacheEntryInput, CacheProvider } from "./utils/cache";
import { createMemoryCacheProvider } from "./utils/cache";
import { CV_REFRESH_WINDOW_MS, cvCheckedKey } from "./utils/cv-refresh";
import type { RateLimitContext, RateLimiter } from "./utils/limiter";
import { createTokenId } from "./utils/token-id";
import { versionsKey } from "./utils/versions";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const storyResponse = () =>
  new Response(JSON.stringify({ story: { id: 1, content: {} }, cv: 1 }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

describe("createApiClient rate limiting", () => {
  it("should not spend the request timeout on time queued behind the rate limit", async () => {
    const client = createApiClient({
      accessToken: "token",
      // Three requests at one per second outlast the timeout while waiting
      // their turn, though none of them is itself slow.
      rateLimit: { requestsPerSecond: 1, adaptive: false },
      timeout: 1000,
      fetch: async () => storyResponse(),
    });

    const results = await Promise.allSettled([
      client.stories.get("a"),
      client.stories.get("b"),
      client.stories.get("c"),
    ]);

    expect(results.map((result) => result.status)).toEqual(["fulfilled", "fulfilled", "fulfilled"]);
  });

  it("should route real requests through a custom limiter", async () => {
    const acquired: RateLimitContext[] = [];
    const released: RateLimitContext[] = [];
    const limiter: RateLimiter = {
      acquire: async (context) => {
        acquired.push(context);
      },
      release: (context) => {
        released.push(context);
      },
    };
    const client = createApiClient({
      accessToken: "token",
      rateLimit: { limiter },
      fetch: async () => storyResponse(),
    });

    await client.stories.get("home");

    expect(acquired).toHaveLength(1);
    expect(acquired[0]).toMatchObject({ bucket: "SINGLE_OR_SMALL", limit: 50 });
    expect(released).toHaveLength(1);
  });

  it("should report a throttled response to the limiter even when a retry succeeds", async () => {
    const statuses: number[] = [];
    const limiter: RateLimiter = {
      acquire: () => Promise.resolve(),
      recordResponse: (_context, response) => {
        statuses.push(response.status);
      },
    };
    let attempt = 0;
    const client = createApiClient({
      accessToken: "token",
      rateLimit: { limiter },
      retry: { limit: 1, backoffLimit: 10 },
      fetch: async () => {
        attempt++;
        return attempt === 1 ? new Response(null, { status: 429 }) : storyResponse();
      },
    });

    await client.stories.get("home");

    // The 429 the retry replaced is the signal a limiter has to act on; only
    // the final 200 would ever reach a caller.
    expect(statuses).toEqual([429, 200]);
  });

  it("should still read a fetch swapped in after the client was created", async () => {
    const originalFetch = globalThis.fetch;
    const client = createApiClient({ accessToken: "token", rateLimit: false });
    const stub = vi.fn(async () => storyResponse());
    globalThis.fetch = stub as unknown as typeof globalThis.fetch;

    try {
      await client.stories.get("home");
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(stub).toHaveBeenCalled();
  });
});

describe("createApiClient get()", () => {
  type Links = { links: Record<string, unknown> };
  const linksResponse = () =>
    new Response(JSON.stringify({ links: { a: {} } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  it("should type data with the given type argument", async () => {
    const client = createApiClient({ accessToken: "token", fetch: async () => linksResponse() });

    const result = await client.get<Links>("/v2/cdn/links");

    expectTypeOf(result.data).toEqualTypeOf<Links | undefined>();
    expect(result.data?.links).toEqual({ a: {} });
  });

  it("should type data as non-optional when throwOnError is enabled", async () => {
    const client = createApiClient({
      accessToken: "token",
      throwOnError: true,
      fetch: async () => linksResponse(),
    });

    const result = await client.get<Links>("/v2/cdn/links");

    expectTypeOf(result.data).toEqualTypeOf<Links>();
    expect(result.data.links).toEqual({ a: {} });
  });

  it("should reject on HTTP errors when throwOnError is enabled", async () => {
    const client = createApiClient({
      accessToken: "token",
      throwOnError: true,
      fetch: async () => new Response(null, { status: 404 }),
    });

    await expect(client.get<Links>("/v2/cdn/links")).rejects.toBeInstanceOf(ClientError);
    await expect(
      client.get<Links>("/v2/cdn/links", { throwOnError: undefined }),
    ).rejects.toBeInstanceOf(ClientError);
  });

  it("should type data as optional when a call disables throwOnError", async () => {
    const client = createApiClient({
      accessToken: "token",
      throwOnError: true,
      fetch: async () => new Response(null, { status: 404 }),
    });

    const result = await client.get<Links>("/v2/cdn/links", { throwOnError: false });

    expectTypeOf(result.data).toEqualTypeOf<Links | undefined>();
    expect(result.data).toBeUndefined();
    expect(result.error).toBeInstanceOf(ClientError);
  });

  it("should type data as non-optional when a call enables throwOnError", async () => {
    const client = createApiClient({ accessToken: "token", fetch: async () => linksResponse() });

    const result = await client.get<Links>("/v2/cdn/links", { throwOnError: true });

    expectTypeOf(result.data).toEqualTypeOf<Links>();
    expect(result.data.links).toEqual({ a: {} });
  });

  it("should accept forwarded HttpRequestOptions", async () => {
    const client = createApiClient({ accessToken: "token", fetch: async () => linksResponse() });
    const options: HttpRequestOptions = { query: { version: "draft" } };

    const result = await client.get<Links>("/v2/cdn/links", options);

    expectTypeOf(result.data).toEqualTypeOf<Links | undefined>();
    expect(result.data?.links).toEqual({ a: {} });
  });

  it("should leave the caller's query untouched and serve a reused one from the cache", async () => {
    let requests = 0;
    const client = createApiClient({
      accessToken: "token",
      fetch: async () => {
        requests++;
        return linksResponse();
      },
    });
    const query = { starts_with: "blog/" };

    await client.get<Links>("/v2/cdn/links", { query });
    await client.get<Links>("/v2/cdn/links", { query });

    expect(query).toEqual({ starts_with: "blog/" });
    expect(requests).toBe(1);
  });

  it("should keep the access token out of cache keys when a query is reused", async () => {
    const provider = createMemoryCacheProvider();
    const keys: string[] = [];
    const client = createApiClient({
      accessToken: "secret-access-token",
      cache: {
        provider: {
          ...provider,
          get: (key) => {
            keys.push(key);
            return provider.get(key);
          },
          set: (key, entry) => {
            keys.push(key);
            return provider.set(key, entry);
          },
        },
      },
      fetch: async () => linksResponse(),
    });
    const query = { starts_with: "blog/" };

    await client.get<Links>("/v2/cdn/links", { query });
    await client.get<Links>("/v2/cdn/links", { query });

    expect(keys.length).toBeGreaterThan(0);
    expect(keys.filter((key) => key.includes("secret-access-token"))).toEqual([]);
  });

  it("should not accept responseStyle", () => {
    const client = createApiClient({ accessToken: "token", fetch: async () => linksResponse() });

    // @ts-expect-error `responseStyle: "data"` would return the unwrapped body
    void client.get<Links>("/v2/cdn/links", { responseStyle: "data" });
  });
});

describe("createApiClient query serialization", () => {
  const requestUrlOf = async (query: Record<string, unknown>) => {
    let requestUrl = "";
    const client = createApiClient({
      accessToken: "token",
      fetch: async (input) => {
        requestUrl = input instanceof Request ? input.url : String(input);
        return storyResponse();
      },
    });
    await client.get("/v2/cdn/stories", { query: { version: "draft", ...query } });
    return new URL(requestUrl);
  };

  it.each(["x&cv", "a=b", "a#b", "a b"])(
    "should send a parameter named %j as one parameter",
    async (name) => {
      const url = await requestUrlOf({ [name]: "1" });

      expect([...url.searchParams].filter(([key]) => key !== "token")).toEqual([
        ["version", "draft"],
        [name, "1"],
      ]);
    },
  );

  it("should send nested filters in raw bracket notation", async () => {
    const url = await requestUrlOf({
      filter_query: { component: { in: "hero" }, __or: [{ a: { is: "true" } }] },
    });

    expect(url.search).toContain(
      "filter_query[component][in]=hero&filter_query[__or][][a][is]=true",
    );
  });
});

describe("createApiClient cv refresh window", () => {
  const BEFORE_PUBLISH = "before publish";
  const AFTER_PUBLISH = "after publish";

  /**
   * Serves every snapshot it ever served for its `cv` (the edge holds old ones for a week) and
   * redirects a published request without a `cv`, or with one it doesn't hold, to the current
   * one. Drafts are served from the origin and never redirected.
   */
  const createCdn = () => {
    const snapshots = new Map<number, string>([[1000, BEFORE_PUBLISH]]);
    const cdn = {
      cv: 1000,
      requests: [] as URL[],
      /** Published requests that went out without a `cv`. */
      bareRequests: 0,
      isOriginDown: false,
      /** Holds redirects of requests without a `cv` until it resolves. */
      redirectsHeld: undefined as Promise<void> | undefined,
      /** Holds responses to requests with a `cv` until it resolves. */
      snapshotsHeld: undefined as Promise<void> | undefined,
      /** Called after a story is served, before any follow-up request. */
      onStoryServed: undefined as (() => void) | undefined,
      publish: (name = AFTER_PUBLISH) => {
        cdn.cv += 1000;
        snapshots.set(cdn.cv, name);
      },
    };

    const serve = async (request: Request, body: (cv: number, name: string) => object) => {
      const url = new URL(request.url);
      cdn.requests.push(url);
      if (url.searchParams.get("version") === "draft") {
        return HttpResponse.json(body(cdn.cv, snapshots.get(cdn.cv) ?? ""));
      }
      const name = snapshots.get(Number(url.searchParams.get("cv")));
      if (name === undefined) {
        if (!url.searchParams.has("cv")) {
          cdn.bareRequests++;
        }
        if (cdn.isOriginDown) {
          return new HttpResponse(null, { status: 503 });
        }
        await cdn.redirectsHeld;
        url.searchParams.set("cv", String(cdn.cv));
        return HttpResponse.redirect(url.toString(), 301);
      }
      await cdn.snapshotsHeld;
      return HttpResponse.json(body(Number(url.searchParams.get("cv")), name));
    };

    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories/:slug", ({ request }) =>
        serve(request, (cv, name) => {
          queueMicrotask(() => cdn.onStoryServed?.());
          const resolvesRelations = new URL(request.url).searchParams.has("resolve_relations");
          return {
            story: {
              id: 1,
              uuid: "home",
              name,
              slug: "home",
              full_slug: "home",
              content: { _uid: "page-1", component: "page", author: "author" },
            },
            ...(resolvesRelations ? { rel_uuids: ["author"] } : {}),
            cv,
          };
        }),
      ),
      http.get("https://api.storyblok.com/v2/cdn/stories", ({ request }) =>
        serve(request, (cv, name) => {
          const uuid = new URL(request.url).searchParams.get("by_uuids") ?? "home";
          return { stories: [{ id: 1, uuid, name, content: {} }], cv };
        }),
      ),
      // `/cdn/links` reports no cv of its own.
      http.get("https://api.storyblok.com/v2/cdn/links", ({ request }) =>
        serve(request, (_cv, name) => ({ links: { home: { id: 1, name } } })),
      ),
      // `/cdn/tags` is never redirected and reports no cv.
      http.get("https://api.storyblok.com/v2/cdn/tags", ({ request }) => {
        cdn.requests.push(new URL(request.url));
        return HttpResponse.json({ tags: [] });
      }),
    );
    return cdn;
  };

  const elapse = (ms: number) => vi.setSystemTime(Date.now() + ms);

  /** Redirects like any story, then answers 404: the slug doesn't exist in any snapshot. */
  const missingStoryHandler = (cdn: ReturnType<typeof createCdn>) =>
    http.get("https://api.storyblok.com/v2/cdn/stories/missing", ({ request }) => {
      const url = new URL(request.url);
      if (!url.searchParams.has("cv")) {
        cdn.bareRequests++;
        url.searchParams.set("cv", String(cdn.cv));
        return HttpResponse.redirect(url.toString(), 301);
      }
      return HttpResponse.json({ error: "Not Found" }, { status: 404 });
    });

  const held = () => {
    let release = () => {};
    const promise = new Promise<void>((resolve) => {
      release = resolve;
    });
    return { promise, release };
  };

  /** A provider object per client over one store, as a per-request Redis wrapper would be. */
  const createStore = () => {
    const store = new Map<string, CacheEntry>();
    return (): CacheProvider => ({
      // The store is heterogeneous; the caller names the expected type via the generic.
      get: async <TValue = unknown>(key: string) =>
        store.get(key) as CacheEntry<TValue> | undefined,
      set: async <TValue = unknown>(key: string, entry: CacheEntryInput<TValue>) => {
        store.set(key, { storedAt: Date.now(), ...entry });
      },
      flush: async () => store.clear(),
    });
  };
  const LONG_TTL_MS = 3_600_000;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should show a publish to a links-only app within one window", async () => {
    const cdn = createCdn();
    const client = createApiClient({ accessToken: "links-only", cache: { ttlMs: 3_000 } });

    await client.links.list();
    cdn.publish();
    elapse(4_000);
    const withinWindow = await client.links.list();
    elapse(CV_REFRESH_WINDOW_MS);
    const afterWindow = await client.links.list();

    // Until the window elapses, the edge serves the snapshot of the cv the client sends.
    expect(withinWindow.data?.links?.home?.name).toBe(BEFORE_PUBLISH);
    expect(afterWindow.data?.links?.home?.name).toBe(AFTER_PUBLISH);
  });

  it("should bypass a cached story once the window elapsed and invalidate older entries", async () => {
    const cdn = createCdn();
    const client = createApiClient({
      accessToken: "cached-stories",
      cache: { ttlMs: LONG_TTL_MS },
    });
    await client.stories.get("home");
    await client.stories.list();

    cdn.publish();
    elapse(CV_REFRESH_WINDOW_MS);
    const story = await client.stories.get("home");
    const stories = await client.stories.list();

    expect(story.data?.story.name).toBe(AFTER_PUBLISH);
    expect(stories.data?.stories[0]?.name).toBe(AFTER_PUBLISH);
  });

  it("should keep serving the cache when the window elapsed without a publish", async () => {
    const cdn = createCdn();
    const client = createApiClient({
      accessToken: "no-publish",
      cache: { ttlMs: LONG_TTL_MS },
    });
    await client.stories.get("home");
    await client.stories.list();
    const bareRequestsBefore = cdn.bareRequests;

    elapse(CV_REFRESH_WINDOW_MS);
    await Promise.all([
      client.stories.get("home"),
      client.stories.get("home"),
      client.stories.list(),
      client.stories.list(),
    ]);
    const requestsAfterProbe = cdn.requests.length;
    elapse(CV_REFRESH_WINDOW_MS - 1);
    await Promise.all([client.stories.get("home"), client.stories.list()]);

    expect(cdn.bareRequests - bareRequestsBefore).toBe(1);
    expect(cdn.requests).toHaveLength(requestsAfterProbe);
  });

  it("should serve the cached entry when the check fails transiently", async () => {
    const cdn = createCdn();
    const client = createApiClient({
      accessToken: "failed-check",
      cache: { ttlMs: LONG_TTL_MS },
      retry: { limit: 0 },
    });
    await client.stories.get("home");
    const bareRequestsBefore = cdn.bareRequests;

    cdn.isOriginDown = true;
    elapse(CV_REFRESH_WINDOW_MS);
    const story = await client.stories.get("home");

    expect(cdn.bareRequests - bareRequestsBefore).toBe(1);
    expect(story.error).toBeUndefined();
    expect(story.data?.story.name).toBe(BEFORE_PUBLISH);
  });

  it("should keep serving cached entries under flush: 'manual' while the check learns the cv", async () => {
    const cdn = createCdn();
    const client = createApiClient({
      accessToken: "flush-manual-check",
      cache: { flush: "manual", ttlMs: LONG_TTL_MS },
    });
    await client.stories.get("home");
    await client.stories.list();
    const bareRequestsBefore = cdn.bareRequests;

    cdn.publish();
    elapse(CV_REFRESH_WINDOW_MS);
    const checkingRead = await client.stories.get("home");
    await vi.waitFor(() => expect(cdn.bareRequests - bareRequestsBefore).toBe(1));
    const [story, stories, cacheMiss] = await Promise.all([
      client.stories.get("home"),
      client.stories.list(),
      client.stories.list({ query: { page: 2 } }),
    ]);

    expect(checkingRead.data?.story.name).toBe(BEFORE_PUBLISH);
    expect(story.data?.story.name).toBe(BEFORE_PUBLISH);
    expect(stories.data?.stories[0]?.name).toBe(BEFORE_PUBLISH);
    expect(cacheMiss.data?.stories[0]?.name).toBe(AFTER_PUBLISH);
  });

  it("should keep sending no cv and serving the cache when cv is manual", async () => {
    const cdn = createCdn();
    const client = createApiClient({
      accessToken: "manual-cv",
      cache: { cv: "manual", ttlMs: LONG_TTL_MS },
    });
    await client.stories.get("home");
    const requestsBefore = cdn.requests.length;

    elapse(CV_REFRESH_WINDOW_MS);
    await client.stories.get("home");

    expect(cdn.requests).toHaveLength(requestsBefore);
  });

  it("should send a caller-pinned cv after the window elapsed", async () => {
    const cdn = createCdn();
    const client = createApiClient({ accessToken: "pinned-cv" });
    await client.stories.list();

    cdn.publish();
    elapse(CV_REFRESH_WINDOW_MS);
    const pinned = await client.stories.get("home", { query: { cv: 1000 } });

    expect(pinned.data?.story.name).toBe(BEFORE_PUBLISH);
    expect(cdn.requests[cdn.requests.length - 1]?.searchParams.get("cv")).toBe("1000");
  });

  it("should not let a draft read take the published read's check", async () => {
    const cdn = createCdn();
    const client = createApiClient({ accessToken: "draft-read", cache: { ttlMs: LONG_TTL_MS } });
    await client.stories.list();
    const bareRequestsBefore = cdn.bareRequests;

    elapse(CV_REFRESH_WINDOW_MS);
    await client.stories.get("home", { query: { version: "draft" } });
    await client.stories.list();

    expect(cdn.bareRequests - bareRequestsBefore).toBe(1);
  });

  it("should share the window between clients sharing a provider", async () => {
    const cdn = createCdn();
    const providerOverStore = createStore();
    const newClient = () =>
      createApiClient({
        accessToken: "shared-window",
        cache: { provider: providerOverStore(), ttlMs: LONG_TTL_MS },
      });
    await newClient().stories.list();
    const bareRequestsBefore = cdn.bareRequests;

    cdn.publish();
    elapse(CV_REFRESH_WINDOW_MS);
    let releaseRedirects = () => {};
    cdn.redirectsHeld = new Promise((resolve) => {
      releaseRedirects = resolve;
    });
    const checking = newClient().stories.get("home");
    // Another client reads while the first one's check is still in flight.
    await vi.waitFor(() => expect(cdn.bareRequests - bareRequestsBefore).toBe(1));
    const readingDuringCheck = newClient().stories.list();
    releaseRedirects();
    const [story] = await Promise.all([checking, readingDuringCheck]);
    const stories = await newClient().stories.list();

    expect(story.data?.story.name).toBe(AFTER_PUBLISH);
    expect(stories.data?.stories[0]?.name).toBe(AFTER_PUBLISH);
    expect(cdn.bareRequests - bareRequestsBefore).toBe(1);
  });

  it("should check a known cv without a check time once", async () => {
    const cdn = createCdn();
    const provider = createMemoryCacheProvider();
    const accessToken = "record-without-check-time";
    await provider.set(versionsKey(createTokenId(accessToken)), {
      value: { knownCv: 1000, highestCv: 1000 },
      ttlMs: LONG_TTL_MS,
    });
    const client = createApiClient({ accessToken, cache: { provider, ttlMs: LONG_TTL_MS } });

    await client.stories.list();
    await client.stories.get("home");

    expect(cdn.bareRequests).toBe(1);
  });

  it("should check a cv whose check time lies in the future", async () => {
    const cdn = createCdn();
    const provider = createMemoryCacheProvider();
    const accessToken = "check-time-ahead";
    const client = createApiClient({ accessToken, cache: { provider, ttlMs: LONG_TTL_MS } });
    await client.stories.list();
    // Written by an instance whose clock runs ahead.
    await provider.set(cvCheckedKey(createTokenId(accessToken)), {
      value: Date.now() + 10 * CV_REFRESH_WINDOW_MS,
      ttlMs: CV_REFRESH_WINDOW_MS,
    });

    cdn.publish();
    elapse(CV_REFRESH_WINDOW_MS);
    const stories = await createApiClient({
      accessToken,
      cache: { provider, ttlMs: LONG_TTL_MS },
    }).stories.list();

    expect(stories.data?.stories[0]?.name).toBe(AFTER_PUBLISH);
  });

  it("should not spend the check on a tags read", async () => {
    const cdn = createCdn();
    const client = createApiClient({ accessToken: "tags-read", cache: { ttlMs: LONG_TTL_MS } });
    await client.stories.list();

    cdn.publish();
    elapse(CV_REFRESH_WINDOW_MS);
    await client.tags.list();
    const stories = await client.stories.list();

    expect(stories.data?.stories[0]?.name).toBe(AFTER_PUBLISH);
  });

  it("should not spend the check on an endpoint the API doesn't redirect", async () => {
    const cdn = createCdn();
    // Served from the edge cache without a cv like any other URL.
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/datasources", () =>
        HttpResponse.json({ datasources: [], cv: 1000 }),
      ),
    );
    const client = createApiClient({ accessToken: "datasources", cache: { ttlMs: LONG_TTL_MS } });
    await client.stories.list();

    cdn.publish();
    elapse(CV_REFRESH_WINDOW_MS);
    await client.datasources.list();
    const stories = await client.stories.list();

    expect(stories.data?.stories[0]?.name).toBe(AFTER_PUBLISH);
  });

  it("should expire datasources read before any cv was known by TTL alone", async () => {
    const cdn = createCdn();
    let datasourceRequests = 0;
    server.use(
      // Served from the edge cache under any URL, never redirected.
      http.get("https://api.storyblok.com/v2/cdn/datasources", () => {
        datasourceRequests++;
        return HttpResponse.json({ datasources: [], cv: 1000 });
      }),
    );
    const client = createApiClient({
      accessToken: "cold-datasources",
      cache: { ttlMs: LONG_TTL_MS },
    });
    await client.datasources.list();
    await client.stories.get("home");

    cdn.publish();
    elapse(CV_REFRESH_WINDOW_MS);
    await client.stories.get("home");
    await client.datasources.list();

    expect(datasourceRequests).toBe(1);
  });

  it("should send one check per window when a custom fetch loses the response URL", async () => {
    const cdn = createCdn();
    const client = createApiClient({
      accessToken: "url-loss",
      cache: { ttlMs: LONG_TTL_MS },
      // Rebuilding the Response drops its URL, and with it the cv links were redirected to.
      fetch: async (input, init) => {
        const response = await fetch(input, init);
        return new Response(response.body, response);
      },
    });
    await client.stories.list();
    const bareRequestsBefore = cdn.bareRequests;

    elapse(CV_REFRESH_WINDOW_MS);
    for (let i = 0; i < 5; i++) {
      await client.links.list({ query: { page: i + 1 } });
    }

    expect(cdn.bareRequests - bareRequestsBefore).toBe(1);
  });

  it.each([false, true])(
    "should learn the current cv from a check answered with a 404 (throwOnError: %s)",
    async (throwOnError) => {
      const cdn = createCdn();
      server.use(missingStoryHandler(cdn));
      const client = createApiClient({
        accessToken: `check-404-${throwOnError}`,
        throwOnError,
        cache: { ttlMs: LONG_TTL_MS },
      });
      await client.stories.get("home");

      cdn.publish();
      elapse(CV_REFRESH_WINDOW_MS);
      await client.stories.get("missing").catch(() => undefined);
      const story = await client.stories.get("home");

      expect(story.data?.story.name).toBe(AFTER_PUBLISH);
    },
  );

  it("should learn the cv from a redirected 404 when no cv is known yet", async () => {
    const cdn = createCdn();
    server.use(missingStoryHandler(cdn));
    const client = createApiClient({ accessToken: "discovery-404", throwOnError: true });

    await client.stories.get("missing").catch(() => undefined);
    const bareRequestsBefore = cdn.bareRequests;
    await client.stories.list();

    expect(cdn.bareRequests - bareRequestsBefore).toBe(0);
  });

  it("should not check again when another client's clock runs slightly ahead", async () => {
    const cdn = createCdn();
    const providerOverStore = createStore();
    const accessToken = "clock-slightly-ahead";
    const newClient = () =>
      createApiClient({
        accessToken,
        cache: { provider: providerOverStore(), ttlMs: LONG_TTL_MS },
      });
    await newClient().stories.list();
    const bareRequestsBefore = cdn.bareRequests;
    await providerOverStore().set(cvCheckedKey(createTokenId(accessToken)), {
      value: Date.now() + 5,
      ttlMs: CV_REFRESH_WINDOW_MS,
    });

    await newClient().stories.list();

    expect(cdn.bareRequests - bareRequestsBefore).toBe(0);
  });

  it("should read the relations of a checked story from its snapshot", async () => {
    const cdn = createCdn();
    const client = createApiClient({
      accessToken: "check-relations",
      inlineRelations: true,
      circularRelations: false,
      cache: { ttlMs: LONG_TTL_MS },
    });
    await client.stories.list();

    cdn.publish();
    elapse(CV_REFRESH_WINDOW_MS);
    // Content is published again between the story and the request for its relations.
    cdn.onStoryServed = () => {
      cdn.onStoryServed = undefined;
      cdn.publish("published again");
    };
    const story = await client.stories.get("home", {
      query: { resolve_relations: "page.author" },
    });

    expect(story.data?.story.name).toBe(AFTER_PUBLISH);
    expect(story.data?.story.content.author).toMatchObject({ name: AFTER_PUBLISH });
  });

  it("should let a custom strategy decide whether the checking read uses the network", async () => {
    const cdn = createCdn();
    const client = createApiClient({
      accessToken: "custom-strategy",
      cache: {
        ttlMs: LONG_TTL_MS,
        strategy: async ({ cachedResult, loadNetwork }) => cachedResult ?? loadNetwork(),
      },
    });
    await client.stories.get("home");
    const requestsBefore = cdn.requests.length;

    elapse(CV_REFRESH_WINDOW_MS);
    await client.stories.get("home");

    expect(cdn.requests).toHaveLength(requestsBefore);
  });

  it("should check on a later read when an swr revalidation of the key is in flight", async () => {
    const cdn = createCdn();
    const client = createApiClient({
      accessToken: "swr-in-flight",
      cache: { strategy: "swr", ttlMs: LONG_TTL_MS },
    });
    await client.stories.get("home");
    const bareRequestsBefore = cdn.bareRequests;

    cdn.publish();
    elapse(CV_REFRESH_WINDOW_MS - 1);
    const revalidation = held();
    cdn.snapshotsHeld = revalidation.promise;
    // Starts a revalidation with the known cv, held by the CDN.
    await client.stories.get("home");
    elapse(1);
    await client.stories.get("home");
    revalidation.release();
    cdn.snapshotsHeld = undefined;
    await vi.waitFor(async () => {
      await client.stories.get("home");
      expect(cdn.bareRequests - bareRequestsBefore).toBe(1);
    });
    const afterCheck = await vi.waitFor(async () => {
      const result = await client.stories.get("home");
      expect(result.data?.story.name).toBe(AFTER_PUBLISH);
      return result;
    });

    expect(afterCheck.data?.story.name).toBe(AFTER_PUBLISH);
  });

  it("should check in the background under swr and show the publish on the next read", async () => {
    const cdn = createCdn();
    const client = createApiClient({
      accessToken: "swr-check",
      cache: { strategy: "swr", ttlMs: LONG_TTL_MS },
    });
    await client.stories.get("home");

    cdn.publish();
    elapse(CV_REFRESH_WINDOW_MS);
    const servedWhileChecking = await client.stories.get("home");
    await vi.waitFor(() => expect(cdn.bareRequests).toBe(2));
    const afterCheck = await client.stories.get("home");

    expect(servedWhileChecking.data?.story.name).toBe(BEFORE_PUBLISH);
    expect(afterCheck.data?.story.name).toBe(AFTER_PUBLISH);
  });
});
