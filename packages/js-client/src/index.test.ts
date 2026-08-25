import StoryblokClient from ".";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ResponseFn } from "./sbFetch";
import SbFetch from "./sbFetch";
import type { ISbLink, ISbStoryData } from "./interfaces";

// Mocking external dependencies
vi.mock("../src/sbFetch", () => {
  const mockGet = vi.fn().mockResolvedValue({
    data: {
      links: "Test data",
    },
    headers: {},
    status: 200,
  });
  const mockPost = vi.fn();
  const mockSetFetchOptions = vi.fn();

  // Define a mock class with baseURL property
  class MockSbFetch {
    private baseURL: string;
    private timeout?: number;
    private headers: Headers;
    private responseInterceptor?: ResponseFn;
    constructor(config: any) {
      this.baseURL = config.baseURL || "https://api.storyblok.com/v2";
      this.responseInterceptor = config.responseInterceptor;
    }

    public get = mockGet;
    public post = mockPost;
    public setFetchOptions = mockSetFetchOptions;
  }

  return {
    default: MockSbFetch,
  };
});

describe("storyblokClient", () => {
  let client: any;

  beforeEach(() => {
    // Setup default mocks
    client = new StoryblokClient({
      accessToken: "test-token",
      /* fetch: mockFetch, */
    });
  });

  describe("initialization", () => {
    it("should initialize a client instance", () => {
      expect(client).toBeDefined();
      expect(client).toBeInstanceOf(StoryblokClient);
    });

    it("should initialize with default values", () => {
      expect(client.maxRetries).toBe(10);
      expect(client.retriesDelay).toBe(300);
      expect(client.cache).toEqual({
        clear: "manual",
      });
      expect(client.relations).toEqual({});
      expect(client.links).toEqual({});

      expect(client.resolveCounter).toBe(0);
      expect(client.resolveNestedRelations).toBeTruthy();
      expect(client.stringifiedStoriesCache).toEqual({});
      expect(client.version).toBe("published");
    });

    it("should set an accessToken", () => {
      expect(client.accessToken).toBe("test-token");
    });

    it("should set a version", () => {
      expect(client.version).toBe("published");
    });

    it("should set an endpoint", () => {
      expect(client.client.baseURL).toBe("https://api.storyblok.com/v2");
    });

    it("should set a fetch instance", () => {
      expect(client.client).toBeInstanceOf(SbFetch);
    });
  });

  describe("configuration via options", () => {
    it("should set a custom endpoint", () => {
      client = new StoryblokClient({
        endpoint: "https://api-custom.storyblok.com/v2",
      });

      expect(client.client.baseURL).toBe("https://api-custom.storyblok.com/v2");
    });
    it("https: should set the http endpoint if option is set to false", () => {
      client = new StoryblokClient({
        accessToken: "test-token",
        https: false,
      });

      expect(client.client.baseURL).toBe("http://api.storyblok.com/v2");
    });
    it("should set the management endpoint v1 if oauthToken is available", () => {
      client = new StoryblokClient({
        oauthToken: "test-token",
      });

      expect(client.client.baseURL).toBe("https://api.storyblok.com/v1");
    });
    it("should set the correct region endpoint", () => {
      client = new StoryblokClient({
        region: "us",
      });

      expect(client.client.baseURL).toBe("https://api-us.storyblok.com/v2");
    });
    it("should set maxRetries", () => {
      client = new StoryblokClient({
        maxRetries: 5,
      });

      expect(client.maxRetries).toBe(5);
    });
    it("should set retriesDelay", () => {
      client = new StoryblokClient({
        retriesDelay: 1000,
      });

      expect(client.retriesDelay).toBe(1000);
    });
    it("should respect retriesDelay of 0", () => {
      client = new StoryblokClient({
        retriesDelay: 0,
      });

      expect(client.retriesDelay).toBe(0);
    });
    // TODO: seems like implmentation is missing
    it.skip("should desactivate resolveNestedRelations", () => {
      client = new StoryblokClient({
        resolveNestedRelations: false,
      });

      expect(client.resolveNestedRelations).toBeFalsy();
    });

    it("should set automatic cache clearing", () => {
      client = new StoryblokClient({
        cache: {
          clear: "auto",
        },
      });

      expect(client.cache.clear).toBe("auto");
    });

    it("should set a responseInterceptor", async () => {
      const responseInterceptor = (response) => {
        return response;
      };

      client = new StoryblokClient({
        responseInterceptor,
      });
      await client.getAll("cdn/links");
      expect(client.client.responseInterceptor).toBe(responseInterceptor);
    });

    it("should set a version", () => {
      client = new StoryblokClient({
        version: "published",
      });

      expect(client.version).toBe("published");
    });
  });

  describe("cache", () => {
    it("should return cacheVersions", async () => {
      const mockExecute = vi.fn().mockResolvedValue({
        data: {
          stories: [{ id: 1, title: "Update" }],
          cv: 1645521118,
        },
        headers: {},
        status: 200,
      });
      client.throttleManager.execute = mockExecute;
      await client.get("test", { version: "draft", token: "test-token" });

      expect(client.cacheVersions()).toEqual({
        "test-token": 1645521118,
      });
    });

    it("should return cacheVersion", async () => {
      const mockExecute = vi.fn().mockResolvedValue({
        data: {
          stories: [{ id: 1, title: "Update" }],
          cv: 1645521118,
        },
        headers: {},
        status: 200,
      });
      client.throttleManager.execute = mockExecute;
      await client.get("test", { version: "draft", token: "test-token" });

      expect(client.cacheVersion("test-token")).toBe(1645521118);
    });

    it("should set the cache version", async () => {
      client.setCacheVersion(1645521118);
      expect(client.cacheVersions()).toEqual({
        "test-token": 1645521118,
      });
    });

    it("should clear the cache", async () => {
      // Mock the cacheProvider and its flush method
      client.cacheProvider = vi.fn().mockReturnValue({
        flush: vi.fn().mockResolvedValue(undefined),
      });
      // Mock the clearCacheVersion method
      client.clearCacheVersion = vi.fn();
      await client.flushCache();

      expect(client.cacheProvider().flush).toHaveBeenCalled();
      expect(client.clearCacheVersion).toHaveBeenCalled();
    });

    it("should clear the cache version", async () => {
      client.clearCacheVersion("test-token");
      expect(client.cacheVersion()).toEqual(0);
    });
  });

  describe("cache invalidation via cdn/spaces/me", () => {
    // `/cdn/spaces/me` reports `space.version` and no `cv`, and is only cached for two
    // seconds — the cheapest way to notice a publish.
    const spaceResponse = (version: number) => ({
      data: { space: { id: 1, name: "Test", version } },
      headers: {},
      status: 200,
    });

    const storiesResponse = (cv: number) => ({
      data: { stories: [{ id: 1, title: "Update" }], cv },
      headers: {},
      status: 200,
    });

    let autoClearClient: any;
    let flushCache: any;

    beforeEach(() => {
      autoClearClient = new StoryblokClient({
        accessToken: "test-token",
        cache: { type: "memory", clear: "auto" },
      });
      flushCache = vi.spyOn(autoClearClient, "flushCache");
    });

    it("should flush the cache when the space reports a new version", async () => {
      const token = "space-version-changed";
      autoClearClient.throttleManager.execute = vi.fn().mockResolvedValue(spaceResponse(1000));
      await autoClearClient.get("cdn/spaces/me", { version: "draft", token });

      expect(flushCache).not.toHaveBeenCalled(); // nothing served yet, nothing to flush

      autoClearClient.throttleManager.execute = vi.fn().mockResolvedValue(spaceResponse(2000));
      await autoClearClient.get("cdn/spaces/me", { version: "draft", token });

      expect(flushCache).toHaveBeenCalledTimes(1);
    });

    it("should flush on the first poll when the cv does not match the space version", async () => {
      // A publish may have landed between the first content request and this poll. A cv
      // that no longer matches the space version gives it away.
      const token = "space-version-first-poll";
      autoClearClient.throttleManager.execute = vi.fn().mockResolvedValue(storiesResponse(1000));
      await autoClearClient.get("cdn/stories", { version: "draft", token });

      autoClearClient.throttleManager.execute = vi.fn().mockResolvedValue(spaceResponse(1500));
      await autoClearClient.get("cdn/spaces/me", { version: "draft", token });

      expect(flushCache).toHaveBeenCalledTimes(1);

      // …but only once: further polls at the same version must not flush again.
      await autoClearClient.get("cdn/spaces/me", { version: "draft", token });
      await autoClearClient.get("cdn/spaces/me", { version: "draft", token });

      expect(flushCache).toHaveBeenCalledTimes(1);
    });

    it("should keep caching after a caller set a cv the API never reported", async () => {
      // `setCacheVersion` takes whatever it is given. Recording it as the never-lowered
      // baseline would make every real response look like a stale edge read, and nothing
      // clears that baseline — one bad call would disable caching for the token for the
      // life of the process.
      const client: any = new StoryblokClient({
        accessToken: "caller-supplied-cv",
        cache: { type: "memory", clear: "auto" },
      });
      client.setCacheVersion(9_999_999_999);

      const execute = vi.fn().mockResolvedValue(storiesResponse(1000));
      client.throttleManager.execute = execute;
      await client.get("cdn/stories", { version: "published" });
      await client.get("cdn/stories", { version: "published" });

      expect(execute).toHaveBeenCalledTimes(1);
    });

    it("should not adopt a lower cv from an edge node that answers after a flush", async () => {
      // A flush zeroes the tracked cv, so the response that follows it is the one that
      // teaches the cv everything afterwards is measured against. An older edge object
      // answering there would re-teach the cv the flush just dropped and make the entries
      // it dropped reachable again, with the space version already recorded and no poll
      // left to raise the signal a second time.
      const token = "stale-cv-after-flush";
      const client: any = new StoryblokClient({
        accessToken: "test-token",
        cache: { type: "memory", clear: "auto" },
      });

      client.throttleManager.execute = vi.fn().mockResolvedValue(storiesResponse(1000));
      await client.get("cdn/stories", { version: "published", token });

      client.throttleManager.execute = vi.fn().mockResolvedValue(spaceResponse(1000));
      await client.get("cdn/spaces/me", { version: "draft", token });

      client.throttleManager.execute = vi.fn().mockResolvedValue(spaceResponse(2000));
      await client.get("cdn/spaces/me", { version: "draft", token }); // publish, cache flushed

      // An edge node still holding the pre-publish snapshot answers the refetch.
      const staleExecute = vi.fn().mockResolvedValue(storiesResponse(900));
      client.throttleManager.execute = staleExecute;
      await client.get("cdn/stories", { version: "published", token });
      await client.get("cdn/stories", { version: "published", token });

      // Neither cached nor believed: the repeat read went back to the network, and the
      // request still carries no cv rather than the older one.
      expect(staleExecute).toHaveBeenCalledTimes(2);
      expect(staleExecute.mock.calls[1][3]).not.toHaveProperty("cv");
    });

    it("should not flush the cache when the space version is unchanged", async () => {
      const token = "space-version-unchanged";
      autoClearClient.throttleManager.execute = vi.fn().mockResolvedValue(spaceResponse(1000));

      await autoClearClient.get("cdn/spaces/me", { version: "draft", token });
      await autoClearClient.get("cdn/spaces/me", { version: "draft", token });
      await autoClearClient.get("cdn/spaces/me", { version: "draft", token });

      expect(flushCache).not.toHaveBeenCalled();
    });

    it("should not track space.version as the cv sent with requests", async () => {
      const token = "space-version-not-a-cv";
      autoClearClient.throttleManager.execute = vi.fn().mockResolvedValue(storiesResponse(1000));
      await autoClearClient.get("cdn/stories", { version: "draft", token });

      autoClearClient.throttleManager.execute = vi.fn().mockResolvedValue(spaceResponse(1500));
      await autoClearClient.get("cdn/spaces/me", { version: "draft", token });

      // The flush drops the tracked cv rather than replacing it with the space version;
      // the cv only ever comes from a content response.
      expect(autoClearClient.cacheVersions()[token]).toBe(0);
    });

    it("should drop the cv for the token that reported the space version", async () => {
      // The signal is keyed by `params.token`, which a request may override, while
      // `flushCache` clears the cv of the client's own token. A cv left behind refills the
      // cache from the edge, which serves `?cv=<old>` for up to a week.
      const token = "space-version-request-token";
      autoClearClient.throttleManager.execute = vi.fn().mockResolvedValue(storiesResponse(1000));
      await autoClearClient.get("cdn/stories", { version: "draft", token });

      autoClearClient.throttleManager.execute = vi.fn().mockResolvedValue(spaceResponse(2000));
      await autoClearClient.get("cdn/spaces/me", { version: "draft", token });
      expect(flushCache).toHaveBeenCalledTimes(1);

      const execute = vi.fn().mockResolvedValue(storiesResponse(3000));
      autoClearClient.throttleManager.execute = execute;
      await autoClearClient.get("cdn/stories", { version: "draft", token });

      // Not merely falsy: `cv=0` would be serialized onto the request.
      expect(execute.mock.calls[0][3]).not.toHaveProperty("cv");
    });

    it("should still flush on a space version change when cv is manual", async () => {
      // With `cv: 'manual'` the cv is tracked but never sent, so behind an edge cache a
      // content response can carry a stale cv forever. `space.version` is the only
      // signal left.
      const token = "space-version-cv-manual";
      const manualCvClient: any = new StoryblokClient({
        accessToken: "test-token",
        cache: { type: "memory", clear: "auto", cv: "manual" },
      });
      const manualCvFlushCache = vi.spyOn(manualCvClient, "flushCache");

      const execute = vi.fn().mockResolvedValue(storiesResponse(1000));
      manualCvClient.throttleManager.execute = execute;
      await manualCvClient.get("cdn/stories", { version: "draft", token });
      await manualCvClient.get("cdn/stories", { version: "draft", token });

      // The cv keeps being tracked from content responses, it is just not sent.
      expect(manualCvClient.cacheVersions()[token]).toBe(1000);
      expect(execute.mock.calls[1][3].cv).toBeUndefined();

      manualCvClient.throttleManager.execute = vi.fn().mockResolvedValue(spaceResponse(2000));
      await manualCvClient.get("cdn/spaces/me", { version: "draft", token });

      // First sighting with content already served: flush once defensively.
      expect(manualCvFlushCache).toHaveBeenCalledTimes(1);

      await manualCvClient.get("cdn/spaces/me", { version: "draft", token });
      expect(manualCvFlushCache).toHaveBeenCalledTimes(1); // unchanged version

      manualCvClient.throttleManager.execute = vi.fn().mockResolvedValue(spaceResponse(3000));
      await manualCvClient.get("cdn/spaces/me", { version: "draft", token });

      expect(manualCvFlushCache).toHaveBeenCalledTimes(2);
    });

    it("should not flush on the first poll when the cv already matches the space version", async () => {
      // Without a Minimum Cache TTL the two report the same number, so an equal pair
      // proves nothing was published and the defensive first flush is not needed.
      const token = "space-version-first-poll-equal";
      autoClearClient.throttleManager.execute = vi.fn().mockResolvedValue(storiesResponse(1000));
      await autoClearClient.get("cdn/stories", { version: "draft", token });

      autoClearClient.throttleManager.execute = vi.fn().mockResolvedValue(spaceResponse(1000));
      await autoClearClient.get("cdn/spaces/me", { version: "draft", token });

      expect(flushCache).not.toHaveBeenCalled();

      // A later change is still detected.
      autoClearClient.throttleManager.execute = vi.fn().mockResolvedValue(spaceResponse(2000));
      await autoClearClient.get("cdn/spaces/me", { version: "draft", token });

      expect(flushCache).toHaveBeenCalledTimes(1);
    });

    it("should ignore a space.version that is not a number", async () => {
      // `response.data` is untyped. A version of another type would never compare equal
      // to the numbers already tracked and would flush on every single poll.
      const token = "space-version-not-a-number";
      autoClearClient.throttleManager.execute = vi.fn().mockResolvedValue(storiesResponse(1000));
      await autoClearClient.get("cdn/stories", { version: "draft", token });

      autoClearClient.throttleManager.execute = vi.fn().mockResolvedValue({
        data: { space: { id: 1, name: "Test", version: "2000" } },
        headers: {},
        status: 200,
      });
      await autoClearClient.get("cdn/spaces/me", { version: "draft", token });
      await autoClearClient.get("cdn/spaces/me", { version: "draft", token });

      expect(flushCache).not.toHaveBeenCalled();
    });

    it("should not flush on a published poll when clear is onpreview", async () => {
      // `onpreview` only clears on draft requests, so polling published content needs
      // `clear: 'auto'`.
      const token = "space-version-onpreview";
      const onPreviewClient: any = new StoryblokClient({
        accessToken: "test-token",
        cache: { type: "memory", clear: "onpreview" },
      });
      const onPreviewFlushCache = vi.spyOn(onPreviewClient, "flushCache");

      onPreviewClient.throttleManager.execute = vi.fn().mockResolvedValue(storiesResponse(1000));
      await onPreviewClient.get("cdn/stories", { version: "published", token });

      onPreviewClient.throttleManager.execute = vi.fn().mockResolvedValue(spaceResponse(2000));
      await onPreviewClient.get("cdn/spaces/me", { version: "published", token });

      expect(onPreviewFlushCache).not.toHaveBeenCalled();
    });

    it("should flush on a draft poll when clear is onpreview", async () => {
      // What decides it is the request's version, not the endpoint: `onpreview` treats
      // every draft request as clearable, so a draft poll does pick publishes up.
      const token = "space-version-onpreview-draft";
      const onPreviewClient: any = new StoryblokClient({
        accessToken: "test-token",
        cache: { type: "memory", clear: "onpreview" },
      });
      const onPreviewFlushCache = vi.spyOn(onPreviewClient, "flushCache");

      onPreviewClient.throttleManager.execute = vi.fn().mockResolvedValue(storiesResponse(1000));
      await onPreviewClient.get("cdn/stories", { version: "published", token });

      onPreviewClient.throttleManager.execute = vi.fn().mockResolvedValue(spaceResponse(1000));
      await onPreviewClient.get("cdn/spaces/me", { version: "draft", token });
      expect(onPreviewFlushCache).not.toHaveBeenCalled(); // equal pair, nothing published

      onPreviewClient.throttleManager.execute = vi.fn().mockResolvedValue(spaceResponse(2000));
      await onPreviewClient.get("cdn/spaces/me", { version: "draft", token });

      expect(onPreviewFlushCache).toHaveBeenCalledTimes(1);
    });

    it("should not let a published poll consume the signal a draft poll needs", async () => {
      // A non-clearable request must observe the space version without recording it.
      // Recording would consume the signal: the draft poll below would find the version
      // unchanged and leave the published cache stale for good.
      const token = "space-version-onpreview-interleaved";
      const onPreviewClient: any = new StoryblokClient({
        accessToken: "test-token",
        cache: { type: "memory", clear: "onpreview" },
      });
      const onPreviewFlushCache = vi.spyOn(onPreviewClient, "flushCache");

      onPreviewClient.throttleManager.execute = vi.fn().mockResolvedValue(storiesResponse(1000));
      await onPreviewClient.get("cdn/stories", { version: "published", token });

      // Published poll: sees the new version but must not flush, nor record it.
      onPreviewClient.throttleManager.execute = vi.fn().mockResolvedValue(spaceResponse(2000));
      await onPreviewClient.get("cdn/spaces/me", { version: "published", token });
      expect(onPreviewFlushCache).not.toHaveBeenCalled();

      // Draft poll: still a first sighting, and 2000 !== the tracked cv of 1000.
      await onPreviewClient.get("cdn/spaces/me", { version: "draft", token });

      expect(onPreviewFlushCache).toHaveBeenCalledTimes(1);
    });

    it("should not flush when polled before any content request", async () => {
      // The recommended startup shape: no tracked cv and nothing cached yet, so there
      // is nothing to flush.
      const token = "space-version-poll-first";
      autoClearClient.throttleManager.execute = vi.fn().mockResolvedValue(spaceResponse(1000));
      await autoClearClient.get("cdn/spaces/me", { version: "draft", token });

      autoClearClient.throttleManager.execute = vi.fn().mockResolvedValue(storiesResponse(1000));
      await autoClearClient.get("cdn/stories", { version: "draft", token });

      autoClearClient.throttleManager.execute = vi.fn().mockResolvedValue(spaceResponse(1000));
      await autoClearClient.get("cdn/spaces/me", { version: "draft", token });

      expect(flushCache).not.toHaveBeenCalled();
    });

    it("should not flush on a space version change when clear is manual", async () => {
      // `clear: 'manual'` — the default — hands cache invalidation to the caller. No
      // request is clearable, so no space version ever triggers a flush by itself.
      const token = "space-version-clear-manual";
      const manualClient: any = new StoryblokClient({
        accessToken: "test-token",
        cache: { type: "memory", clear: "manual" },
      });
      const manualFlushCache = vi.spyOn(manualClient, "flushCache");

      manualClient.throttleManager.execute = vi.fn().mockResolvedValue(storiesResponse(1000));
      await manualClient.get("cdn/stories", { version: "draft", token });

      manualClient.throttleManager.execute = vi.fn().mockResolvedValue(spaceResponse(1500));
      await manualClient.get("cdn/spaces/me", { version: "draft", token });

      manualClient.throttleManager.execute = vi.fn().mockResolvedValue(spaceResponse(2000));
      await manualClient.get("cdn/spaces/me", { version: "draft", token });

      expect(manualFlushCache).not.toHaveBeenCalled();
    });

    it("should not attach a cv to the poll request from a reused params object", async () => {
      // `parseParams` stamps the cv onto the caller's object, so a params object reused
      // across calls arrives at the poll already carrying one. The endpoint polling
      // relies on must not have its edge cache fragmented by a cache buster.
      const token = "space-version-reused-params";
      const execute = vi.fn(async (_rl: any, _m: any, url: string) =>
        url === "/cdn/spaces/me" ? spaceResponse(1000) : storiesResponse(1000),
      );
      autoClearClient.throttleManager.execute = execute;

      const params = { version: "draft", token };
      await autoClearClient.get("cdn/stories", params); // tracks cv 1000
      await autoClearClient.get("cdn/stories", params); // stamps params.cv = 1000
      await autoClearClient.get("cdn/spaces/me", params);

      const poll = execute.mock.calls.find((call) => call[2] === "/cdn/spaces/me");
      expect((poll?.[3] as any).cv).toBeUndefined();
    });

    it("should not treat the cleared cv sentinel as a tracked cv on the first poll", async () => {
      // `flushCache` and `clearCacheVersion` record the sentinel `0`, which carries no cv
      // information. Comparing it against a space version can only ever be unequal, so
      // the first poll after a clear would flush the whole module-level cache for nothing.
      const token = "space-version-cleared-sentinel";
      const client: any = new StoryblokClient({
        accessToken: token,
        cache: { type: "memory", clear: "auto" },
      });

      client.throttleManager.execute = vi.fn().mockResolvedValue(storiesResponse(1000));
      await client.get("cdn/stories", { version: "draft", token });
      client.clearCacheVersion();

      const clearedFlushCache = vi.spyOn(client, "flushCache");
      // The space version equals the cv tracked before the clear: nothing was published.
      client.throttleManager.execute = vi.fn().mockResolvedValue(spaceResponse(1000));
      await client.get("cdn/spaces/me", { version: "draft", token });

      expect(clearedFlushCache).not.toHaveBeenCalled();
    });

    it("should not let a response in flight across a flush re-pin the cv it dropped", async () => {
      // A published request answered for the version before the flush must not refill the
      // cache it emptied, and must not restore the cv the flush dropped: the cv is part of
      // the cache key, so restoring it makes those stale entries reachable again — with
      // the space version already recorded and no later poll left to notice the publish.
      const token = "space-version-inflight-race";
      const client: any = new StoryblokClient({
        accessToken: token,
        cache: { type: "memory", clear: "auto" },
      });

      client.throttleManager.execute = vi.fn().mockResolvedValue(storiesResponse(1000));
      await client.get("cdn/stories/warm", { version: "published", token });
      expect(client.cacheVersion()).toBe(1000);

      // A request for a not-yet-cached key goes out carrying cv 1000 and is held there.
      let releaseRaced: (value: unknown) => void = () => {};
      const inFlight = new Promise((resolve) => {
        releaseRaced = resolve;
      });
      client.throttleManager.execute = vi.fn(async (_rl: any, _m: any, url: string) =>
        url === "/cdn/spaces/me" ? spaceResponse(2000) : inFlight,
      );
      const racedRequest = client.get("cdn/stories/raced", { version: "published", token });

      // The poll notices the publish and flushes, dropping the tracked cv.
      await client.get("cdn/spaces/me", { version: "draft", token });
      expect(client.cacheVersion()).toBe(0);

      // The held request now resolves with its pre-publish body and the old cv.
      releaseRaced(storiesResponse(1000));
      await racedRequest;
      expect(client.cacheVersion()).toBe(0); // not re-pinned to 1000

      // So the next read of that key reaches the network and gets the published content.
      client.throttleManager.execute = vi.fn().mockResolvedValue({
        data: { stories: [{ id: 1, title: "Published" }], cv: 2000 },
        headers: {},
        status: 200,
      });
      const after = await client.get("cdn/stories/raced", { version: "published", token });

      expect(after.data.stories[0].title).toBe("Published");
    });

    it("should not attach a cv to the poll request", async () => {
      // The cv is a cache buster and `/cdn/spaces/me` is not cached: one there would
      // only fragment the edge cache of the endpoint polling relies on.
      const token = "space-version-no-cv-on-poll";
      autoClearClient.throttleManager.execute = vi.fn().mockResolvedValue(storiesResponse(1000));
      await autoClearClient.get("cdn/stories", { version: "draft", token });

      const execute = vi.fn().mockResolvedValue(spaceResponse(1000));
      autoClearClient.throttleManager.execute = execute;
      await autoClearClient.get("cdn/spaces/me", { version: "draft", token });

      expect(execute.mock.calls[0][3].cv).toBeUndefined();
    });

    it("should keep the cv of a response that also reports a space version", async () => {
      // Only `/cdn/spaces/me` reports a space version today and it carries no cv, but if
      // one response ever reported both, the space-version flush must not drop the cv
      // that arrived with it — hence space version before cv. The token is the client's
      // own access token so `flushCache` clears the cv this test tracks.
      const token = "space-version-and-cv-in-one-response";
      const client: any = new StoryblokClient({
        accessToken: token,
        cache: { type: "memory", clear: "auto" },
      });
      const bothSignals = (value: number) => ({
        data: { space: { id: 1, name: "Test", version: value }, cv: value },
        headers: {},
        status: 200,
      });

      client.throttleManager.execute = vi.fn().mockResolvedValue(bothSignals(2000));
      await client.get("cdn/spaces/me", { version: "draft" });
      expect(client.cacheVersions()[token]).toBe(2000);

      // A publish landed: both signals move together, the cache is flushed, and the cv
      // from this very response has to survive it.
      client.throttleManager.execute = vi.fn().mockResolvedValue(bothSignals(3000));
      await client.get("cdn/spaces/me", { version: "draft" });

      expect(client.cacheVersions()[token]).toBe(3000);
    });

    it("should treat every spelling of the poll slug the same", async () => {
      // `get()` prefixes the slug with a slash, so `'/cdn/spaces/me'` must not become
      // `//cdn/spaces/me` — that fails every path comparison at once, leaving the poll
      // carrying a cv, its response cached, and the space version never read. A trailing
      // slash, which the API serves identically, must not either.
      const poll = async (slug: string, token: string) => {
        const client: any = new StoryblokClient({
          accessToken: "test-token",
          cache: { type: "memory", clear: "auto" },
        });
        const clientFlushCache = vi.spyOn(client, "flushCache");
        const polls: { url: string; cv: unknown }[] = [];

        client.throttleManager.execute = vi.fn(
          async (_rateLimit: any, _method: any, url: string, params: any) => {
            if (url.includes("spaces/me")) {
              polls.push({ url, cv: params.cv });
              return spaceResponse(2000);
            }
            return storiesResponse(1000);
          },
        );

        await client.get("cdn/stories", { version: "published", token });
        await client.get(slug, { version: "published", token });
        await client.get(slug, { version: "published", token });

        return { polls, flushes: clientFlushCache.mock.calls.length };
      };

      const bare = await poll("cdn/spaces/me", "slug-spelling-bare");
      const prefixed = await poll("/cdn/spaces/me", "slug-spelling-prefixed");
      const trailing = await poll("cdn/spaces/me/", "slug-spelling-trailing");

      expect(prefixed).toEqual(bare);
      expect(trailing).toEqual(bare);
      // …and the behaviour they share is the correct one: every poll reaches the network
      // without a cv, and the first sighting flushes once.
      expect(bare.polls).toEqual([
        { url: "/cdn/spaces/me", cv: undefined },
        { url: "/cdn/spaces/me", cv: undefined },
      ]);
      expect(bare.flushes).toBe(1);
    });

    it("should not flush repeatedly when a Minimum Cache TTL floors the cv", async () => {
      // A Minimum Cache TTL floors the cv into buckets while `space.version` reports the
      // raw version: they differ permanently and must never be compared to each other.
      const token = "space-version-min-cache";
      const flooredCv = 1786950000;
      const rawSpaceVersion = 1786950860;

      for (let i = 0; i < 3; i++) {
        autoClearClient.throttleManager.execute = vi
          .fn()
          .mockResolvedValue(spaceResponse(rawSpaceVersion));
        await autoClearClient.get("cdn/spaces/me", { version: "draft", token });

        autoClearClient.throttleManager.execute = vi
          .fn()
          .mockResolvedValue(storiesResponse(flooredCv));
        await autoClearClient.get("cdn/stories", { version: "draft", token });
      }

      expect(flushCache).not.toHaveBeenCalled();
      expect(autoClearClient.cacheVersions()[token]).toBe(flooredCv);
    });

    it("should send no cv and cache the response after a flush", async () => {
      // The flush records the sentinel `0`, which is not a version the API knows: sending
      // `cv=0` costs a redirect and caches the response under a key no later request
      // reads, so the content just published stays invisible for the whole cache lifetime.
      const token = "space-version-post-flush-cv";
      autoClearClient.throttleManager.execute = vi.fn().mockResolvedValue(storiesResponse(1000));
      await autoClearClient.get("cdn/stories", { version: "published", token });

      autoClearClient.throttleManager.execute = vi.fn().mockResolvedValue(spaceResponse(2000));
      await autoClearClient.get("cdn/spaces/me", { version: "draft", token });
      expect(flushCache).toHaveBeenCalledTimes(1);

      const execute = vi.fn().mockResolvedValue(storiesResponse(2000));
      autoClearClient.throttleManager.execute = execute;
      await autoClearClient.get("cdn/stories", { version: "published", token });

      expect(execute.mock.calls[0][3]).not.toHaveProperty("cv");

      // The cv this response reported is attached from here on, and the response was
      // stored under it rather than under the cv it was issued with — so every later read
      // finds it and none of them reaches the network.
      await autoClearClient.get("cdn/stories", { version: "published", token });
      await autoClearClient.get("cdn/stories", { version: "published", token });

      expect(execute).toHaveBeenCalledTimes(1);
    });

    it("should keep the response that triggered the flush in the cache", async () => {
      // The flush empties the cache for the version the response left behind, not for the
      // response itself: storing it first and flushing after would drop it immediately.
      const token = "cv-flush-keeps-triggering-response";
      autoClearClient.throttleManager.execute = vi.fn().mockResolvedValue(storiesResponse(1000));
      await autoClearClient.get("cdn/stories", { version: "published", token });

      const execute = vi.fn().mockResolvedValue(storiesResponse(2000));
      autoClearClient.throttleManager.execute = execute;
      const response = await autoClearClient.get("cdn/stories/other", {
        version: "published",
        token,
      });
      expect(flushCache).toHaveBeenCalledTimes(1);

      // The pre-flush entry is gone and the response that caused the flush is there.
      const cached = Object.values(await autoClearClient.cacheProvider().getAll());
      expect(cached).toEqual([response]);
    });

    it("should not flush when the space version moves backwards", async () => {
      // `space.version` is monotonic at the origin, so a lower one is an edge node whose
      // two-second cache has not caught up. Flushing for it empties the cache for nothing
      // — and on the way back up it would flush a second time.
      const token = "space-version-regression";
      autoClearClient.throttleManager.execute = vi.fn().mockResolvedValue(storiesResponse(2000));
      await autoClearClient.get("cdn/stories", { version: "published", token });

      for (const version of [2000, 1000, 2000]) {
        autoClearClient.throttleManager.execute = vi.fn().mockResolvedValue(spaceResponse(version));
        await autoClearClient.get("cdn/spaces/me", { version: "draft", token });
      }

      expect(flushCache).not.toHaveBeenCalled();
    });

    it("should not adopt a cv that moved backwards", async () => {
      // A response reporting a lower cv came from an edge node still holding an older
      // snapshot: adopting it would pin every later request to content the space has
      // already moved past.
      const token = "cv-regression";
      autoClearClient.throttleManager.execute = vi.fn().mockResolvedValue(storiesResponse(2000));
      await autoClearClient.get("cdn/stories", { version: "published", token });

      autoClearClient.throttleManager.execute = vi.fn().mockResolvedValue(storiesResponse(1000));
      await autoClearClient.get("cdn/stories/other", { version: "published", token });

      expect(flushCache).not.toHaveBeenCalled();
      expect(autoClearClient.cacheVersions()[token]).toBe(2000);
    });

    it("should flush a shared provider once per process, not once per instance", async () => {
      // The serverless shape: a client per request, one external provider, and a token
      // with a Minimum Cache TTL so the floored cv never equals the raw space version.
      // Keying the signal per instance made every fresh client see an ambiguous first
      // sighting and empty the shared cache on its own first poll.
      const token = "space-version-shared-provider";
      const flooredCv = 1786950000;
      const rawSpaceVersion = 1786950860;
      const store: Record<string, any> = {};
      const flush = vi.fn(async () => {
        for (const key of Object.keys(store)) {
          delete store[key];
        }
      });
      const provider = {
        get: async (key: string) => store[key],
        getAll: async () => store,
        set: async (key: string, content: any) => {
          store[key] = content;
        },
        flush,
      };
      const newClient = (): any =>
        new StoryblokClient({
          accessToken: "test-token",
          cache: { clear: "auto", type: "custom", custom: provider },
        });

      let storyRequests = 0;
      const execute = vi.fn(async (_rateLimit: any, _method: any, url: string) => {
        if (url.includes("spaces/me")) {
          return spaceResponse(rawSpaceVersion);
        }
        storyRequests++;
        return storiesResponse(flooredCv);
      });

      const warm = newClient();
      warm.throttleManager.execute = execute;
      await warm.get("cdn/stories", { version: "published", token });

      for (let i = 0; i < 4; i++) {
        const client = newClient();
        client.throttleManager.execute = execute;
        await client.get("cdn/spaces/me", { version: "draft", token });
        await client.get("cdn/stories", { version: "published", token });
      }

      // One ambiguous first sighting for the whole process, then steady state.
      expect(flush).toHaveBeenCalledTimes(1);
      // The warm read and the read after that one flush. The second one is stored under
      // the cv it settled on rather than the one it was issued with, so it is the entry
      // every later round reads and the remaining rounds add nothing.
      expect(storyRequests).toBe(2);
    });

    it("should share the flush epoch between instances writing to the same provider", async () => {
      // A response in flight when another instance flushed the same cache belongs to the
      // version that flush dropped, so it must not be stored — while a flush of an
      // unrelated provider must not stall this one's cache fill.
      const token = "flush-epoch-per-provider";
      const store: Record<string, any> = {};
      const provider = {
        get: async (key: string) => store[key],
        getAll: async () => store,
        set: async (key: string, content: any) => {
          store[key] = content;
        },
        flush: async () => {
          for (const key of Object.keys(store)) {
            delete store[key];
          }
        },
      };
      const shared = (): any =>
        new StoryblokClient({
          accessToken: "test-token",
          cache: { clear: "auto", type: "custom", custom: provider },
        });

      const reader = shared();
      let release!: () => void;
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      reader.throttleManager.execute = vi.fn(async () => {
        await held;
        return storiesResponse(1000);
      });
      const inFlight = reader.get("cdn/stories", { version: "published", token });
      // Let the request reach the network before the flush: one that has not left yet is
      // answered with the version that follows the flush, and caching it is correct.
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Another instance flushes the very cache that request is about to write to.
      await shared().flushCache();
      release();
      await inFlight;

      expect(Object.keys(store)).toHaveLength(0);

      // A flush of a different provider leaves this one alone.
      const other: any = new StoryblokClient({
        accessToken: "test-token",
        cache: { clear: "auto", type: "memory" },
      });
      const second = shared();
      second.throttleManager.execute = vi.fn(async () => {
        await other.flushCache();
        return storiesResponse(1000);
      });
      await second.get("cdn/stories", { version: "published", token });

      expect(Object.keys(store)).toHaveLength(1);
    });

    it("should not let a response land in the middle of a flush", async () => {
      // Emptying the provider and moving the epoch are not one step: a response resolving
      // between them would find the epoch it was issued under still current and write
      // itself into the cache the flush had already cleared.
      const token = "flush-window";
      const store: Record<string, any> = {};
      let releaseFlush!: () => void;
      const flushHeld = new Promise<void>((resolve) => {
        releaseFlush = resolve;
      });
      const provider = {
        get: async (key: string) => store[key],
        getAll: async () => store,
        set: async (key: string, content: any) => {
          store[key] = content;
        },
        flush: async () => {
          for (const key of Object.keys(store)) {
            delete store[key];
          }
          // Emptied, but not finished: an external provider's flush resolves a round trip
          // later, and the epoch has to have moved before that.
          await flushHeld;
        },
      };
      const shared = (): any =>
        new StoryblokClient({
          accessToken: "test-token",
          cache: { clear: "auto", type: "custom", custom: provider },
        });

      const reader = shared();
      let releaseResponse!: () => void;
      const responseHeld = new Promise<void>((resolve) => {
        releaseResponse = resolve;
      });
      reader.throttleManager.execute = vi.fn(async () => {
        await responseHeld;
        return storiesResponse(1000);
      });
      const inFlight = reader.get("cdn/stories", { version: "published", token });
      await new Promise((resolve) => setTimeout(resolve, 0));

      const flushing = shared().flushCache();
      // The response comes back while the provider is still being emptied.
      releaseResponse();
      await inFlight;
      releaseFlush();
      await flushing;

      expect(Object.keys(store)).toHaveLength(0);
    });

    it("should flush at most once per keyspace after the cv was cleared", async () => {
      // The baseline outliving a flush must not make the sighting recur: it fires until
      // the keyspace has recorded a space version, which the first poll does whether it
      // flushed or not.
      const token = "space-version-cleared-cv-bound";
      autoClearClient.throttleManager.execute = vi.fn().mockResolvedValue(storiesResponse(1000));
      await autoClearClient.get("cdn/stories", { version: "published", token });

      autoClearClient.clearCacheVersion(token);

      for (let i = 0; i < 4; i++) {
        autoClearClient.throttleManager.execute = vi.fn().mockResolvedValue(spaceResponse(2000));
        await autoClearClient.get("cdn/spaces/me", { version: "draft", token });
      }

      expect(flushCache).toHaveBeenCalledTimes(1);
    });

    it("should still flush a custom provider when another instance already flushed", async () => {
      // The narrower shape of the case below, and the one that used to slip through: the
      // instance that polls first flushes and clears the tracked cv, so the second
      // instance found no cv to compare its own first sighting against and never flushed.
      // One token, two instances, one publish, and only the first instance recovered.
      const token = "space-version-custom-after-flush";
      const store: Record<string, any> = {};
      const customFlush = vi.fn(async () => {
        for (const key of Object.keys(store)) {
          delete store[key];
        }
      });
      const customClient: any = new StoryblokClient({
        accessToken: "test-token",
        cache: {
          clear: "auto",
          cv: "manual",
          type: "custom",
          custom: {
            get: async (key: string) => store[key],
            getAll: async () => store,
            set: async (key: string, content: any) => {
              store[key] = content;
            },
            flush: customFlush,
          },
        },
      });
      const memoryClient: any = new StoryblokClient({
        accessToken: "test-token",
        cache: { clear: "auto", cv: "manual", type: "memory" },
      });

      // Both instances serve the same pre-publish content.
      for (const instance of [customClient, memoryClient]) {
        instance.throttleManager.execute = vi.fn().mockResolvedValue(storiesResponse(1000));
        await instance.get("cdn/stories", { version: "published", token });
      }

      // The memory instance polls first: it flushes, and clears the tracked cv with it.
      memoryClient.throttleManager.execute = vi.fn().mockResolvedValue(spaceResponse(2000));
      await memoryClient.get("cdn/spaces/me", { version: "draft", token });
      expect(memoryClient.cacheVersions()[token]).toBe(0);

      // The custom instance has still never seen a space version, and its provider still
      // holds the pre-publish entry.
      customClient.throttleManager.execute = vi.fn().mockResolvedValue(spaceResponse(2000));
      await customClient.get("cdn/spaces/me", { version: "draft", token });

      expect(customFlush).toHaveBeenCalledTimes(1);
      expect(Object.keys(store)).toHaveLength(0);
    });

    it("should not let another instance consume the signal for a custom provider", async () => {
      // The signal is consumed once per keyspace. An instance with its own provider has
      // to flush it itself, so an instance on the module-level memory cache must not
      // record the sighting on its behalf and leave its cache stale for good.
      const token = "space-version-custom-provider";
      const store: Record<string, any> = {};
      const customFlush = vi.fn(async () => {
        for (const key of Object.keys(store)) {
          delete store[key];
        }
      });
      const customClient: any = new StoryblokClient({
        accessToken: "test-token",
        cache: {
          clear: "auto",
          type: "custom",
          custom: {
            get: async (key: string) => store[key],
            getAll: async () => store,
            set: async (key: string, content: any) => {
              store[key] = content;
            },
            flush: customFlush,
          },
        },
      });
      const memoryClient: any = new StoryblokClient({
        accessToken: "test-token",
        cache: { clear: "auto", type: "memory" },
      });

      customClient.throttleManager.execute = vi.fn().mockResolvedValue(storiesResponse(1000));
      await customClient.get("cdn/stories", { version: "published", token });

      // The memory instance polls first and notices the publish for its own cache.
      memoryClient.throttleManager.execute = vi.fn().mockResolvedValue(spaceResponse(2000));
      await memoryClient.get("cdn/spaces/me", { version: "draft", token });
      expect(customFlush).not.toHaveBeenCalled();

      // The custom instance is still serving the pre-publish entry and has not seen a
      // space version yet.
      customClient.throttleManager.execute = vi.fn().mockResolvedValue(storiesResponse(1500));
      await customClient.get("cdn/stories/other", { version: "published", token });

      customClient.throttleManager.execute = vi.fn().mockResolvedValue(spaceResponse(2000));
      await customClient.get("cdn/spaces/me", { version: "draft", token });

      expect(customFlush).toHaveBeenCalledTimes(1);
    });
  });

  describe("cache key of a published response", () => {
    // A response has to be stored under the key the next identical read builds. The cv is
    // part of that key, so the entry is written with the cv the client will send next —
    // but only where the client is the one choosing it, and only in the position
    // `parseParams` would have put it in. Getting either wrong writes an entry no read
    // ever looks up, and the content is fetched again on every read for as long as the
    // cache lives.
    const storiesResponse = (cv: number) => ({
      data: { stories: [{ id: 1, title: "Update" }], cv },
      headers: {},
      status: 200,
    });

    const publishedClient = (cache: any) =>
      new StoryblokClient({ accessToken: "test-token", cache }) as any;

    it("should serve the second identical published request from the cache", async () => {
      const token = "settled-key-plain";
      const client = publishedClient({ type: "memory", clear: "auto" });
      const execute = vi.fn().mockResolvedValue(storiesResponse(1000));
      client.throttleManager.execute = execute;

      await client.get("cdn/stories", { version: "published", token });
      await client.get("cdn/stories", { version: "published", token });

      expect(execute).toHaveBeenCalledTimes(1);
    });

    it("should serve a published request carrying resolve_relations from the cache", async () => {
      // `parseParams` assigns the cv before `resolve_level`, so an entry keyed with the cv
      // appended last is unreachable for every request that resolves relations.
      const token = "settled-key-resolve-relations";
      const client = publishedClient({ type: "memory", clear: "auto" });
      const execute = vi.fn().mockResolvedValue(storiesResponse(1000));
      client.throttleManager.execute = execute;

      const params = { version: "published", resolve_relations: "blog.author", token };
      await client.get("cdn/stories", { ...params });
      await client.get("cdn/stories", { ...params });

      expect(execute).toHaveBeenCalledTimes(1);
    });

    it("should serve a published request carrying a falsy cv from the cache", async () => {
      // `parseParams` substitutes the tracked cv for a falsy one, so `cv: 0` is not a
      // caller's choice of snapshot however it was meant. Reading it as one leaves the
      // entry keyed by the zero the request no longer carries.
      const token = "settled-key-zero-cv";
      const client = publishedClient({ type: "memory", clear: "auto" });
      const execute = vi.fn().mockResolvedValue(storiesResponse(1000));
      client.throttleManager.execute = execute;

      await client.get("cdn/stories", { version: "published", cv: 0, token });
      await client.get("cdn/stories", { version: "published", cv: 0, token });

      expect(execute).toHaveBeenCalledTimes(1);
    });

    it("should serve a published request from the cache when cv is manual", async () => {
      // `'manual'` never sends a cv, so no read builds a key containing one. The cv is
      // still tracked from response bodies, and writing it into the key would take the
      // whole mode out of the cache.
      const token = "settled-key-manual";
      const client = publishedClient({ type: "memory", clear: "auto", cv: "manual" });
      const execute = vi.fn().mockResolvedValue(storiesResponse(1000));
      client.throttleManager.execute = execute;

      await client.get("cdn/stories", { version: "published", token });
      await client.get("cdn/stories", { version: "published", token });

      expect(execute).toHaveBeenCalledTimes(1);
      expect(client.cacheVersions()[token]).toBe(1000);
    });

    it("should serve a published request pinned to a cv from the cache", async () => {
      // The caller's cv is part of their key. Replacing it with the tracked one files the
      // snapshot they asked for under a key they never read.
      const token = "settled-key-pinned";
      const client = publishedClient({ type: "memory", clear: "auto" });
      const execute = vi.fn().mockResolvedValue(storiesResponse(1000));
      client.throttleManager.execute = execute;

      await client.get("cdn/stories", { version: "published", cv: 444, token });
      await client.get("cdn/stories", { version: "published", cv: 444, token });

      expect(execute).toHaveBeenCalledTimes(1);
    });

    it("should cache a pinned cv the space has already moved past", async () => {
      // The edge serves a snapshot for as long as it holds it, so a caller pinning an
      // older cv gets that older body and its older cv back. Judging it by the tracked cv
      // makes it a stale edge read, and the one request that asked for an older snapshot
      // is the one that is never cached.
      const token = "settled-key-pinned-older";
      const client = publishedClient({ type: "memory", clear: "auto" });
      client.throttleManager.execute = vi.fn().mockResolvedValue(storiesResponse(1000));
      await client.get("cdn/stories", { version: "published", token });

      const execute = vi.fn().mockResolvedValue(storiesResponse(900));
      client.throttleManager.execute = execute;
      await client.get("cdn/stories", { version: "published", cv: 900, token });
      await client.get("cdn/stories", { version: "published", cv: 900, token });

      expect(execute).toHaveBeenCalledTimes(1);
      // And the snapshot the caller asked for never moved the tracked version backwards:
      // the next request the client keys itself still goes out with the newer cv.
      await client.get("cdn/stories/other", { version: "published", token });
      expect(execute.mock.calls[execute.mock.calls.length - 1][3].cv).toBe(1000);
    });

    it("should still store the response under the settled cv after its own flush", async () => {
      // The case the settled key exists for: a response reports a new cv and flushes the
      // cache on its way in, so the key the next read builds carries a cv the request it
      // was issued under did not have.
      const token = "settled-key-after-flush";
      const client = publishedClient({ type: "memory", clear: "auto" });
      client.throttleManager.execute = vi.fn().mockResolvedValue(storiesResponse(1000));
      await client.get("cdn/stories/first", { version: "published", token });

      const execute = vi.fn().mockResolvedValue(storiesResponse(2000));
      client.throttleManager.execute = execute;
      await client.get("cdn/stories/second", { version: "published", token });
      await client.get("cdn/stories/second", { version: "published", token });

      expect(execute).toHaveBeenCalledTimes(1);
    });
  });

  describe("get() parameter handling", () => {
    it("should not modify the params object it was given", async () => {
      // Callers reuse one params object across requests. Stamping the version, token and
      // cv onto it carries request state into the next call and changes an object the
      // caller still holds.
      const client: any = new StoryblokClient({ accessToken: "params-token" });
      client.throttleManager.execute = vi.fn().mockResolvedValue({
        data: { stories: [], cv: 1000 },
        headers: {},
        status: 200,
      });
      const params = { starts_with: "blog" };

      await client.get("cdn/stories", params);

      expect(params).toEqual({ starts_with: "blog" });
    });

    it("should not modify the params object getAll was given", async () => {
      const client: any = new StoryblokClient({ accessToken: "params-token-getall" });
      client.throttleManager.execute = vi.fn().mockResolvedValue({
        data: { stories: [], cv: 1000, total: 0 },
        headers: {},
        status: 200,
      });
      const params = { starts_with: "blog" };

      await client.getAll("cdn/stories", params);

      expect(params).toEqual({ starts_with: "blog" });
    });
  });

  describe("retry behaviour on 429", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should retry the request after a 429 using the configured retriesDelay", async () => {
      client = new StoryblokClient({
        retriesDelay: 500,
        maxRetries: 3,
      });

      const mockGet = vi
        .fn()
        .mockRejectedValueOnce({
          status: 429,
          statusText: "Too Many Requests",
          response: {},
        })
        .mockResolvedValueOnce({
          data: { story: { id: 1 } },
          headers: {},
          status: 200,
        });

      client.client = {
        get: mockGet,
        post: vi.fn(),
        setFetchOptions: vi.fn(),
        baseURL: "https://api.storyblok.com/v2",
      };

      const promise = client.cacheResponse("/cdn/stories", { token: "test-token" });
      await vi.advanceTimersByTimeAsync(500);

      await expect(promise).resolves.toMatchObject({ data: { story: { id: 1 } } });
      expect(mockGet).toHaveBeenCalledTimes(2);
    });

    it("should not re-send a cv a flush dropped while the retry was waiting", async () => {
      // The retry is a new request built from the params of the old one. Re-sending the
      // pre-flush cv asks the edge for the snapshot the flush was meant to leave behind,
      // and the response then teaches that cv back — the flush undone by the retry that
      // outlived it.
      client = new StoryblokClient({
        accessToken: "retry-cv-token",
        retriesDelay: 500,
        maxRetries: 3,
        cache: { type: "memory", clear: "auto" },
      });

      // Recorded as copies: the retry reuses the params object, so the mock's own
      // references would all show its final state.
      const sentParams: Array<Record<string, unknown>> = [];
      const mockGet = vi
        .fn()
        .mockImplementationOnce((_url: string, params: Record<string, unknown>) => {
          sentParams.push({ ...params });
          return Promise.reject({ status: 429, statusText: "Too Many Requests", response: {} });
        })
        .mockImplementationOnce((_url: string, params: Record<string, unknown>) => {
          sentParams.push({ ...params });
          return Promise.resolve({ data: { stories: [], cv: 1000 }, headers: {}, status: 200 });
        });

      client.client = {
        get: mockGet,
        post: vi.fn(),
        setFetchOptions: vi.fn(),
        baseURL: "https://api.storyblok.com/v2",
      };
      client.setCacheVersion(1000);

      const promise = client.cacheResponse("/cdn/stories", {
        token: "retry-cv-token",
        version: "published",
        cv: 1000,
      });
      await client.flushCache(); // a publish was noticed while the retry was waiting
      await vi.advanceTimersByTimeAsync(500);
      await promise;

      expect(sentParams[0].cv).toBe(1000);
      expect(sentParams[1]).not.toHaveProperty("cv");
    });

    it("should keep the per-request fetchOptions on a retried request", async () => {
      client = new StoryblokClient({
        retriesDelay: 500,
        maxRetries: 3,
      });

      const mockGet = vi
        .fn()
        .mockRejectedValueOnce({
          status: 429,
          statusText: "Too Many Requests",
          response: {},
        })
        .mockResolvedValueOnce({
          data: { story: { id: 1 } },
          headers: {},
          status: 200,
        });

      const mockSetFetchOptions = vi.fn();
      client.client = {
        get: mockGet,
        post: vi.fn(),
        setFetchOptions: mockSetFetchOptions,
        baseURL: "https://api.storyblok.com/v2",
      };

      const fetchOptions = { cache: "no-store" as RequestCache };
      const promise = client.cacheResponse(
        "/cdn/stories",
        { token: "test-token" },
        undefined,
        fetchOptions,
      );
      await vi.advanceTimersByTimeAsync(500);
      await promise;

      expect(mockGet).toHaveBeenCalledTimes(2);
      // The two attempts must apply the same fetchOptions. A retry that drops
      // them loses the cache configuration that the caller supplied.
      expect(mockSetFetchOptions).toHaveBeenCalledTimes(2);
      expect(mockSetFetchOptions).toHaveBeenNthCalledWith(1, fetchOptions);
      expect(mockSetFetchOptions).toHaveBeenNthCalledWith(2, fetchOptions);
    });

    it("should give up after maxRetries 429 responses", async () => {
      client = new StoryblokClient({
        retriesDelay: 10,
        maxRetries: 2,
      });

      const mockGet = vi.fn().mockRejectedValue({
        status: 429,
        statusText: "Too Many Requests",
        response: {},
      });

      client.client = {
        get: mockGet,
        post: vi.fn(),
        setFetchOptions: vi.fn(),
        baseURL: "https://api.storyblok.com/v2",
      };

      const promise = client.cacheResponse("/cdn/stories", { token: "test-token" });
      const assertion = expect(promise).rejects.toMatchObject({ status: 429 });
      await vi.advanceTimersByTimeAsync(100);
      await assertion;

      // Initial call + 2 retries = 3 total
      expect(mockGet).toHaveBeenCalledTimes(3);
    });
  });

  describe("get", () => {
    it("should handle API errors gracefully", async () => {
      const mockGet = vi.fn().mockRejectedValue({
        status: 404,
        statusText: "Not Found",
      });

      client.client = {
        get: mockGet,
        post: vi.fn(),
        setFetchOptions: vi.fn(),
        baseURL: "https://api.storyblok.com/v2",
      };

      await expect(client.get("cdn/stories/non-existent")).rejects.toMatchObject({
        status: 404,
      });
    });

    it("should only add version parameter for CDN URLs", async () => {
      const mockCacheResponse = vi.fn().mockResolvedValue({ data: {} });
      client.cacheResponse = mockCacheResponse;

      // Test CDN URL - should add version parameter
      await client.get("cdn/stories");
      expect(mockCacheResponse).toHaveBeenCalledWith(
        "/cdn/stories",
        expect.objectContaining({ version: "published" }),
        undefined,
        undefined,
        false,
      );

      // Reset mock
      mockCacheResponse.mockClear();

      // Test Management API URL - should NOT add version parameter
      await client.get("spaces/123/stories/456");
      expect(mockCacheResponse).toHaveBeenCalledWith(
        "/spaces/123/stories/456",
        expect.not.objectContaining({ version: expect.anything() }),
        undefined,
        undefined,
        false,
      );
    });

    it("should fetch and return a complex story object correctly", async () => {
      const mockComplexStory = {
        data: {
          story: {
            id: 123456,
            uuid: "story-uuid-123",
            name: "Complex Page",
            slug: "complex-page",
            full_slug: "folder/complex-page",
            created_at: "2023-01-01T12:00:00.000Z",
            published_at: "2023-01-02T12:00:00.000Z",
            first_published_at: "2023-01-02T12:00:00.000Z",
            content: {
              _uid: "content-123",
              component: "page",
              title: "Complex Page Title",
              subtitle: "Complex Page Subtitle",
              intro: {
                _uid: "intro-123",
                component: "intro",
                heading: "Welcome to our page",
                text: "Some introduction text",
              },
              body: [
                {
                  _uid: "text-block-123",
                  component: "text_block",
                  text: "First paragraph of content",
                },
                {
                  _uid: "image-block-123",
                  component: "image",
                  src: "https://example.com/image.jpg",
                  alt: "Example image",
                },
                {
                  _uid: "related-items-123",
                  component: "related_items",
                  items: ["uuid1", "uuid2"], // Relations that we won't resolve in this test
                },
              ],
              seo: {
                _uid: "seo-123",
                component: "seo",
                title: "SEO Title",
                description: "SEO Description",
                og_image: "https://example.com/og-image.jpg",
              },
            },
            position: 1,
            is_startpage: false,
            parent_id: 654321,
            group_id: "789-group",
            alternates: [],
            translated_slugs: [],
            default_full_slug: null,
            lang: "default",
          },
        },
        headers: {},
        status: 200,
        statusText: "OK",
      };

      const mockGet = vi.fn().mockResolvedValue(mockComplexStory);

      client.client = {
        get: mockGet,
        post: vi.fn(),
        setFetchOptions: vi.fn(),
        baseURL: "https://api.storyblok.com/v2",
      };

      const result = await client.get("cdn/stories/folder/complex-page");

      // Verify the complete story structure is returned correctly
      expect(result.data.story).toMatchObject({
        id: 123456,
        uuid: "story-uuid-123",
        name: "Complex Page",
        slug: "complex-page",
        full_slug: "folder/complex-page",
        content: expect.objectContaining({
          _uid: "content-123",
          component: "page",
          title: "Complex Page Title",
          subtitle: "Complex Page Subtitle",
          intro: expect.objectContaining({
            _uid: "intro-123",
            component: "intro",
          }),
          body: expect.arrayContaining([
            expect.objectContaining({
              component: "text_block",
            }),
            expect.objectContaining({
              component: "image",
            }),
            expect.objectContaining({
              component: "related_items",
            }),
          ]),
        }),
      });

      // Verify specific nested properties
      expect(result.data.story.content.seo).toEqual({
        _uid: "seo-123",
        component: "seo",
        title: "SEO Title",
        description: "SEO Description",
        og_image: "https://example.com/og-image.jpg",
      });

      // Verify that relations array exists but remains unresolved
      expect(result.data.story.content.body[2].items).toEqual(["uuid1", "uuid2"]);

      // Verify the API was called only once (no relation resolution)
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it("should enrich inline assets with data from an asset object", async () => {
      const story = {
        data: {
          story: {
            id: 123456,
            uuid: "story-uuid-123",
            name: "Page",
            slug: "page",
            full_slug: "folder/page",
            created_at: "2023-01-01T12:00:00.000Z",
            published_at: "2023-01-02T12:00:00.000Z",
            first_published_at: "2023-01-02T12:00:00.000Z",
            content: {
              _uid: "content-123",
              component: "page",
              image: {
                id: 87196701025710,
                alt: "story alt",
                name: "image",
                focus: "",
                title: "",
                source: "",
                filename:
                  "https://a.storyblok.com/f/286701504322473/1888x1538/3cc0705569/image.jpeg",
                copyright: "",
                fieldtype: "asset",
                meta_data: {
                  alt: "story alt",
                  title: "",
                  source: "",
                  copyright: "",
                },
                is_external_url: false,
              },
            },
            position: 1,
            is_startpage: false,
            parent_id: 654321,
            group_id: "789-group",
            alternates: [],
            translated_slugs: [],
            default_full_slug: null,
            lang: "default",
          },
          rels: [],
          links: [],
          assets: [
            {
              id: 87196701025710,
              content_type: "image/jpeg",
              content_length: 438695,
              created_at: "2025-09-04T09:24:17.084Z",
              updated_at: "2025-09-04T09:35:53.799Z",
              deleted_at: null,
              alt: "asset alt",
              title: "",
              copyright: "",
              focus: "",
              is_private: false,
              s3_filename:
                "https://a.storyblok.com/f/286701504322473/1888x1538/3cc0705569/image.jpeg",
              meta_data: {
                alt: "asset alt",
                title: "",
                source: "",
                copyright: "",
              },
            },
          ],
        },
        headers: {},
        status: 200,
        statusText: "OK",
      };

      const mockGet = vi.fn().mockResolvedValue(story);

      client.client = {
        get: mockGet,
        post: vi.fn(),
        setFetchOptions: vi.fn(),
        baseURL: "https://api.storyblok.com/v2",
      };
      client.inlineAssets = true;

      const result = await client.get("cdn/stories/folder/complex-page");

      expect(result.data.story.content.image).toEqual({
        alt: "story alt",
        content_length: 438695,
        content_type: "image/jpeg",
        copyright: "",
        created_at: "2025-09-04T09:24:17.084Z",
        deleted_at: null,
        fieldtype: "asset",
        filename: "https://a.storyblok.com/f/286701504322473/1888x1538/3cc0705569/image.jpeg",
        focus: "",
        id: 87196701025710,
        is_external_url: false,
        is_private: false,
        meta_data: {
          alt: "story alt",
          copyright: "",
          source: "",
          title: "",
        },
        name: "image",
        s3_filename: "https://a.storyblok.com/f/286701504322473/1888x1538/3cc0705569/image.jpeg",
        source: "",
        title: "",
        updated_at: "2025-09-04T09:35:53.799Z",
      });
    });

    describe("cdn/links endpoint", () => {
      it("should fetch links with dates when include_dates is set to 1", async () => {
        const mockLinksResponse = {
          data: {
            links: {
              "story-1": {
                id: 1,
                uuid: "story-1-uuid",
                slug: "story-1",
                name: "Story 1",
                is_folder: false,
                parent_id: 0,
                published: true,
                position: 0,
                // Date fields included because of include_dates: 1
                created_at: "2024-01-01T10:00:00.000Z",
                published_at: "2024-01-01T11:00:00.000Z",
                updated_at: "2024-01-02T10:00:00.000Z",
              },
              "story-2": {
                id: 2,
                uuid: "story-2-uuid",
                slug: "story-2",
                name: "Story 2",
                is_folder: false,
                parent_id: 0,
                published: true,
                position: 1,
                created_at: "2024-01-03T10:00:00.000Z",
                published_at: "2024-01-03T11:00:00.000Z",
                updated_at: "2024-01-04T10:00:00.000Z",
              },
            },
          },
          headers: {},
          status: 200,
        };

        const mockGet = vi.fn().mockResolvedValue(mockLinksResponse);

        client.client = {
          get: mockGet,
          post: vi.fn(),
          setFetchOptions: vi.fn(),
          baseURL: "https://api.storyblok.com/v2",
        };

        const response = await client.get("cdn/links", {
          version: "draft",
          include_dates: 1,
        });

        // Verify the structure of the response
        expect(response).toHaveProperty("data.links");

        // Check if links are present and have the correct structure
        expect(response.data.links["story-1"]).toBeDefined();
        expect(response.data.links["story-2"]).toBeDefined();

        // Verify date fields are present in the response
        const link: ISbLink = response.data.links["story-1"];
        expect(link).toHaveProperty("created_at");
        expect(link).toHaveProperty("published_at");
        expect(link).toHaveProperty("updated_at");

        // Verify the date formats
        const DATETIME_FORMAT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
        expect(link.created_at).toMatch(DATETIME_FORMAT);
        expect(link.published_at).toMatch(DATETIME_FORMAT);
        expect(link.updated_at).toMatch(DATETIME_FORMAT);

        // Verify the API was called with correct parameters
        expect(mockGet).toHaveBeenCalledWith("/cdn/links", {
          token: "test-token",
          version: "draft",
          include_dates: 1,
        });
        expect(mockGet).toHaveBeenCalledTimes(1);
      });

      it("should handle links response without dates when include_dates is not set", async () => {
        const mockResponse = {
          data: {
            links: {
              "story-1": {
                id: 1,
                uuid: "story-1-uuid",
                slug: "story-1",
                name: "Story 1",
                is_folder: false,
                parent_id: 0,
                published: true,
                position: 0,
                // No date fields
              },
            },
          },
          headers: {},
          status: 200,
        };

        const mockGet = vi.fn().mockResolvedValue(mockResponse);
        client.client.get = mockGet;

        const response = await client.get("cdn/links", { version: "draft" });

        expect(response.data.links["story-1"]).not.toHaveProperty("created_at");
        expect(response.data.links["story-1"]).not.toHaveProperty("published_at");
        expect(response.data.links["story-1"]).not.toHaveProperty("updated_at");
      });

      it("should handle errors gracefully", async () => {
        const mockGet = vi.fn().mockRejectedValue({
          status: 404,
        });
        client.client.get = mockGet;

        await expect(
          client.get("cdn/links", {
            version: "draft",
          }),
        ).rejects.toMatchObject({
          status: 404,
        });
      });
    });
  });

  describe("getAll", () => {
    it("should fetch all data from the API", async () => {
      const mockMakeRequest = vi.fn().mockResolvedValue({
        data: {
          links: [
            { id: 1, name: "Test 1" },
            { id: 2, name: "Test 2" },
          ],
        },
        headers: {},
        status: 200,
      });
      client.makeRequest = mockMakeRequest;
      const result = await client.getAll("links", { version: "draft" });
      expect(result).toEqual([
        { id: 1, name: "Test 1" },
        { id: 2, name: "Test 2" },
      ]);
    });

    it("should resolve using entity option", async () => {
      const mockMakeRequest = vi.fn().mockResolvedValue({
        data: {
          custom: [
            { id: 1, name: "Test 1" },
            { id: 2, name: "Test 2" },
          ],
        },
        headers: {},
        status: 200,
      });
      client.makeRequest = mockMakeRequest;
      const result = await client.getAll("cdn/links", { version: "draft" }, "custom");
      expect(result).toEqual([
        { id: 1, name: "Test 1" },
        { id: 2, name: "Test 2" },
      ]);
    });

    it("should make a request for each page", async () => {
      const mockMakeRequest = vi.fn().mockResolvedValue({
        data: {
          links: [
            { id: 1, name: "Test 1" },
            { id: 2, name: "Test 2" },
          ],
        },
        total: 2,
        status: 200,
      });
      client.makeRequest = mockMakeRequest;
      await client.getAll("links", { per_page: 1 });
      expect(mockMakeRequest).toBeCalledTimes(2);
    });

    it("should get all stories if the slug is passed with the trailing slash", async () => {
      const mockMakeRequest = vi.fn().mockResolvedValue({
        data: {
          stories: [
            { id: 1, name: "Test Story 1" },
            { id: 2, name: "Test Story 2" },
          ],
        },
        total: 2,
        status: 200,
      });
      client.makeRequest = mockMakeRequest;
      const result = await client.getAll("cdn/stories/", { version: "draft" });
      expect(result).toEqual([
        { id: 1, name: "Test Story 1" },
        { id: 2, name: "Test Story 2" },
      ]);
    });

    it("should use API response perPage for pagination calculation when per_page not provided", async () => {
      // When per_page is not provided and API returns different perPage
      const mockMakeRequestFixed = vi
        .fn()
        .mockResolvedValueOnce({
          data: {
            stories: Array.from({ length: 100 }, (_, i) => ({ id: i + 1, name: `Story ${i + 1}` })),
          },
          total: 1000, // Total stories
          perPage: 100, // API returns 100 per page (different from client default 25)
          status: 200,
        })

        // getAll should calculate Math.ceil(1000/100) = 10 pages using firstRes.perPage
        .mockResolvedValue({
          data: {
            stories: Array.from({ length: 100 }, (_, i) => ({
              id: i + 101,
              name: `Story ${i + 101}`,
            })),
          },
          total: 1000,
          perPage: 100,
          status: 200,
        });

      client.makeRequest = mockMakeRequestFixed;
      await client.getAll("cdn/stories", { version: "draft" });

      // Should make 10 requests (1 + 9) using firstRes.perPage = 100
      expect(mockMakeRequestFixed).toHaveBeenCalledTimes(10);
    });

    it("should fall back to client perPage when API does not return perPage", async () => {
      // Test fallback behavior when API doesn't return perPage
      const mockMakeRequestFallback = vi
        .fn()
        .mockResolvedValueOnce({
          data: {
            stories: Array.from({ length: 25 }, (_, i) => ({ id: i + 1, name: `Story ${i + 1}` })),
          },
          total: 100, // Total stories
          // perPage: undefined, // API doesn't return perPage
          status: 200,
        })
        .mockResolvedValue({
          data: {
            stories: Array.from({ length: 25 }, (_, i) => ({
              id: i + 26,
              name: `Story ${i + 26}`,
            })),
          },
          total: 100,
          status: 200,
        });

      client.makeRequest = mockMakeRequestFallback;
      await client.getAll("cdn/stories", { version: "draft" });

      // Should fall back to client default perPage = 25: Math.ceil(100/25) = 4 requests
      expect(mockMakeRequestFallback).toHaveBeenCalledTimes(4);
    });
  });

  describe("post", () => {
    it("should post data to the API", async () => {
      const mockExecute = vi.fn().mockResolvedValue({
        data: {
          stories: [{ id: 1, title: "Keep me posted" }],
        },
        headers: {},
        status: 200,
      });
      client.throttleManager.execute = mockExecute;
      const result = await client.post("test", { data: "test" });
      expect(result).toEqual({
        data: {
          stories: [{ id: 1, title: "Keep me posted" }],
        },
        headers: {},
        status: 200,
      });
    });
  });

  describe("put", () => {
    it("should put data to the API", async () => {
      const mockExecute = vi.fn().mockResolvedValue({
        data: {
          stories: [{ id: 1, title: "Update" }],
        },
        headers: {},
        status: 200,
      });
      client.throttleManager.execute = mockExecute;
      const result = await client.put("test", { data: "test" });
      expect(result).toEqual({
        data: {
          stories: [{ id: 1, title: "Update" }],
        },
        headers: {},
        status: 200,
      });
    });
  });

  describe("patch", () => {
    it("should patch data to the API", async () => {
      const mockExecute = vi.fn().mockResolvedValue({
        data: {
          story: { id: 1, title: "Patch" },
        },
        headers: {},
        status: 200,
      });
      client.throttleManager.execute = mockExecute;
      const result = await client.patch("test", { data: "test" });
      expect(result).toEqual({
        data: {
          story: { id: 1, title: "Patch" },
        },
        headers: {},
        status: 200,
      });
    });
  });

  describe("delete", () => {
    it("should delete data from the API", async () => {
      const mockExecute = vi.fn().mockResolvedValue({
        data: {
          stories: [{ id: 1, title: "Delete" }],
        },
        headers: {},
        status: 200,
      });
      client.throttleManager.execute = mockExecute;
      const result = await client.delete("test");
      expect(result).toEqual({
        data: {
          stories: [{ id: 1, title: "Delete" }],
        },
        headers: {},
        status: 200,
      });
    });
  });

  it("should resolve stories when response contains a story or stories", async () => {
    const mockExecute = vi.fn().mockResolvedValue({
      data: { stories: [{ id: 1, title: "Test Story" }] },
      headers: {},
      status: 200,
    });
    client.throttleManager.execute = mockExecute;
    client.resolveStories = vi.fn().mockResolvedValue({
      id: 1,
      title: "Test Story",
    });

    await client.cacheResponse("/test-url", {
      token: "test-token",
      version: "published",
    });

    expect(client.resolveStories).toHaveBeenCalled();
    expect(client.resolveCounter).toBe(1);
  });

  it("should return access token", () => {
    expect(client.getToken()).toBe("test-token");
  });

  describe("relation resolution", () => {
    it("should resolve more than 50 relations correctly", async () => {
      // Create 60 UUIDs to exceed the 50 relation limit
      const TEST_UUIDS = Array.from({ length: 60 }, (_, i) => `test-uuid-${i}`);

      // Mock story with multiple relation fields
      const mockResponse = {
        data: {
          story: {
            content: {
              _uid: "root-uid",
              component: "page",
              items: TEST_UUIDS.slice(0, 30), // First 30 UUIDs
              otherItems: TEST_UUIDS.slice(30), // Next 30 UUIDs
            },
          },
          // Include rel_uuids but not rels to simulate API behavior
          rel_uuids: TEST_UUIDS,
        },
        headers: {},
        status: 200,
        statusText: "OK",
      };

      // Create first chunk response (first 50 relations)
      const mockFirstChunkResponse = {
        data: {
          stories: TEST_UUIDS.slice(0, 50).map((uuid) => ({
            uuid,
            name: `Story ${uuid}`,
            content: { component: "test-component", _uid: uuid },
            full_slug: `stories/${uuid}`,
          })),
        },
        headers: {},
        status: 200,
        statusText: "OK",
      };

      // Create second chunk response (remaining relations)
      const mockSecondChunkResponse = {
        data: {
          stories: TEST_UUIDS.slice(50).map((uuid) => ({
            uuid,
            name: `Story ${uuid}`,
            content: { component: "test-component", _uid: uuid },
            full_slug: `stories/${uuid}`,
          })),
        },
        headers: {},
        status: 200,
        statusText: "OK",
      };

      // Setup the mock client's get method
      const mockGet = vi
        .fn()
        .mockImplementationOnce(() => Promise.resolve(mockResponse))
        .mockImplementationOnce(() => Promise.resolve(mockFirstChunkResponse))
        .mockImplementationOnce(() => Promise.resolve(mockSecondChunkResponse));

      // Replace the client's fetch instance
      client.client = {
        get: mockGet,
        post: vi.fn(),
        setFetchOptions: vi.fn(),
      };

      const result = await client.get("cdn/stories/test", {
        resolve_relations: ["page.items", "page.otherItems"],
      });

      // Ensure all relations were resolved
      const story = result.data.story;
      expect(story.content.items).toBeInstanceOf(Array);
      expect(story.content.items.length).toBe(30);
      expect(story.content.otherItems).toBeInstanceOf(Array);
      expect(story.content.otherItems.length).toBe(30);

      // Check that first and last items from each array were properly resolved
      // First array items should be objects, not UUIDs
      expect(typeof story.content.items[0]).toBe("object");
      expect(story.content.items[0].uuid).toBe("test-uuid-0");
      expect(story.content.items[0].name).toBe("Story test-uuid-0");
      expect(story.content.items[0].content.component).toBe("test-component");

      // Last item in first array
      expect(typeof story.content.items[29]).toBe("object");
      expect(story.content.items[29].uuid).toBe("test-uuid-29");

      // First item in second array
      expect(typeof story.content.otherItems[0]).toBe("object");
      expect(story.content.otherItems[0].uuid).toBe("test-uuid-30");

      // Last item in second array
      expect(typeof story.content.otherItems[29]).toBe("object");
      expect(story.content.otherItems[29].uuid).toBe("test-uuid-59");

      // Ensure rel_uuids was removed after resolution
      expect(result.data.rel_uuids).toBeUndefined();

      // Verify the API was called correctly for chunking
      expect(mockGet).toHaveBeenCalledTimes(3);

      // Check the parameters in second call (first chunk)
      const firstChunkParams = mockGet.mock.calls[1][1];
      expect(firstChunkParams).toHaveProperty("by_uuids");
      expect(firstChunkParams.by_uuids).toContain("test-uuid-0");

      // Check the parameters in third call (second chunk)
      const secondChunkParams = mockGet.mock.calls[2][1];
      expect(secondChunkParams).toHaveProperty("by_uuids");
      expect(secondChunkParams.by_uuids).toContain("test-uuid-50");
    });

    it("should resolve nested relations within content blocks", async () => {
      const TEST_UUID = "this-is-a-test-uuid";

      const mockResponse = {
        data: {
          story: {
            content: {
              _uid: "parent-uid",
              component: "page",
              body: [
                {
                  _uid: "slider-uid",
                  component: "event_slider",
                  spots: [
                    {
                      _uid: "event-uid",
                      component: "event",
                      content: {
                        _uid: "content-uid",
                        component: "event",
                        event_type: TEST_UUID,
                      },
                    },
                  ],
                },
              ],
            },
          },
          rel_uuids: [TEST_UUID],
        },
        headers: {},
        status: 200,
        statusText: "OK",
      };

      const mockRelationsResponse = {
        data: {
          stories: [
            {
              _uid: "type-uid",
              uuid: TEST_UUID,
              content: {
                name: "Test Event Type",
                component: "event_type",
              },
            },
          ],
        },
        headers: {},
        status: 200,
        statusText: "OK",
      };

      // Setup the mock client's get method
      const mockGet = vi
        .fn()
        .mockImplementationOnce(() => Promise.resolve(mockResponse))
        .mockImplementationOnce(() => Promise.resolve(mockRelationsResponse));

      // Replace the client's fetch instance
      client.client = {
        get: mockGet,
        post: vi.fn(),
        setFetchOptions: vi.fn(),
      };

      const result = await client.get("cdn/stories/test", {
        resolve_relations: ["event.event_type", "event_slider.spots"],
        version: "draft",
      });

      // Verify that the UUID was replaced with the resolved object
      const resolvedEventType = result.data.story.content.body[0].spots[0].content.event_type;
      expect(resolvedEventType).toEqual({
        _uid: "type-uid",
        uuid: TEST_UUID,
        content: {
          name: "Test Event Type",
          component: "event_type",
        },
        _stopResolving: true,
      });

      // Verify that get was called two times
      expect(mockGet).toHaveBeenCalledTimes(2);
    });

    it("should resolve an array of relations", async () => {
      const TEST_UUIDS = ["tag-1-uuid", "tag-2-uuid"];

      const mockResponse = {
        data: {
          story: {
            content: {
              _uid: "root-uid",
              component: "post",
              tags: TEST_UUIDS,
            },
          },
          rel_uuids: TEST_UUIDS,
        },
        headers: {},
        status: 200,
        statusText: "OK",
      };

      const mockRelationsResponse = {
        data: {
          stories: [
            {
              _uid: "tag-1-uid",
              uuid: TEST_UUIDS[0],
              content: {
                name: "Tag 1",
                component: "tag",
              },
            },
            {
              _uid: "tag-2-uid",
              uuid: TEST_UUIDS[1],
              content: {
                name: "Tag 2",
                component: "tag",
              },
            },
          ],
        },
        headers: {},
        status: 200,
        statusText: "OK",
      };

      const mockGet = vi
        .fn()
        .mockImplementationOnce(() => Promise.resolve(mockResponse))
        .mockImplementationOnce(() => Promise.resolve(mockRelationsResponse));

      client.client = {
        get: mockGet,
        post: vi.fn(),
        setFetchOptions: vi.fn(),
        baseURL: "https://api.storyblok.com/v2",
      };

      const result = await client.get("cdn/stories/test", {
        resolve_relations: ["post.tags"],
        version: "draft",
      });

      expect(result.data.story.content.tags).toEqual([
        {
          _uid: "tag-1-uid",
          uuid: TEST_UUIDS[0],
          content: {
            name: "Tag 1",
            component: "tag",
          },
          _stopResolving: true,
        },
        {
          _uid: "tag-2-uid",
          uuid: TEST_UUIDS[1],
          content: {
            name: "Tag 2",
            component: "tag",
          },
          _stopResolving: true,
        },
      ]);
    });

    it("should resolve multiple relation patterns simultaneously", async () => {
      const AUTHOR_UUID = "author-uuid";
      const CATEGORY_UUID = "category-uuid";

      const mockResponse = {
        data: {
          story: {
            content: {
              _uid: "root-uid",
              component: "post",
              author: AUTHOR_UUID,
              category: CATEGORY_UUID,
            },
          },
          rel_uuids: [AUTHOR_UUID, CATEGORY_UUID],
        },
        headers: {},
        status: 200,
        statusText: "OK",
      };

      const mockRelationsResponse = {
        data: {
          stories: [
            {
              _uid: "author-uid",
              uuid: AUTHOR_UUID,
              content: {
                name: "John Doe",
                component: "author",
              },
            },
            {
              _uid: "category-uid",
              uuid: CATEGORY_UUID,
              content: {
                name: "Technology",
                component: "category",
              },
            },
          ],
        },
        headers: {},
        status: 200,
        statusText: "OK",
      };

      const mockGet = vi
        .fn()
        .mockImplementationOnce(() => Promise.resolve(mockResponse))
        .mockImplementationOnce(() => Promise.resolve(mockRelationsResponse));

      client.client = {
        get: mockGet,
        post: vi.fn(),
        setFetchOptions: vi.fn(),
        baseURL: "https://api.storyblok.com/v2",
      };

      const result = await client.get("cdn/stories/test", {
        resolve_relations: ["post.author", "post.category"],
        version: "draft",
      });

      expect(result.data.story.content.author).toEqual({
        _uid: "author-uid",
        uuid: AUTHOR_UUID,
        content: {
          name: "John Doe",
          component: "author",
        },
        _stopResolving: true,
      });

      expect(result.data.story.content.category).toEqual({
        _uid: "category-uid",
        uuid: CATEGORY_UUID,
        content: {
          name: "Technology",
          component: "category",
        },
        _stopResolving: true,
      });
    });

    it("should handle content with no relations to resolve", async () => {
      const mockResponse = {
        data: {
          story: {
            content: {
              _uid: "test-story-uid",
              component: "page",
              title: "Simple Page",
              text: "Just some text content",
              number: 42,
              boolean: true,
            },
          },
        },
        headers: {},
        status: 200,
        statusText: "OK",
      };

      const mockGet = vi.fn().mockImplementationOnce(() => Promise.resolve(mockResponse));

      client.client = {
        get: mockGet,
        post: vi.fn(),
        setFetchOptions: vi.fn(),
        baseURL: "https://api.storyblok.com/v2",
      };

      const result = await client.get("cdn/stories/test", {
        resolve_relations: ["page.author"], // Even with resolve_relations, nothing should change
        version: "draft",
      });

      // Verify the content remains unchanged
      expect(result.data.story.content).toEqual({
        _uid: "test-story-uid",
        component: "page",
        title: "Simple Page",
        text: "Just some text content",
        number: 42,
        boolean: true,
      });

      // Verify that only one API call was made (no relations to resolve)
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it("should handle invalid relation patterns gracefully", async () => {
      const mockResponse = {
        data: {
          story: {
            content: {
              _uid: "test-uid",
              component: "page",
              relation_field: "some-uuid",
            },
          },
        },
        headers: {},
        status: 200,
        statusText: "OK",
      };

      const mockGet = vi.fn().mockImplementationOnce(() => Promise.resolve(mockResponse));

      client.client = {
        get: mockGet,
        post: vi.fn(),
        setFetchOptions: vi.fn(),
        baseURL: "https://api.storyblok.com/v2",
      };

      const result = await client.get("cdn/stories/test", {
        resolve_relations: ["invalid.pattern"],
        version: "draft",
      });

      // Should not throw and return original content
      expect(result.data.story.content.relation_field).toBe("some-uuid");
    });

    it("should handle empty resolve_relations array", async () => {
      const mockResponse = {
        data: {
          story: {
            content: {
              _uid: "test-uid",
              component: "page",
              relation_field: "some-uuid",
            },
          },
        },
        headers: {},
        status: 200,
        statusText: "OK",
      };

      const mockGet = vi.fn().mockImplementationOnce(() => Promise.resolve(mockResponse));

      client.client = {
        get: mockGet,
        post: vi.fn(),
        setFetchOptions: vi.fn(),
        baseURL: "https://api.storyblok.com/v2",
      };

      const result = await client.get("cdn/stories/test", {
        resolve_relations: [],
        version: "draft",
      });

      expect(result.data.story.content.relation_field).toBe("some-uuid");
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it("should pass starts_with parameter when resolving relations and links", async () => {
      // Setup mocks
      const TEST_UUID = "test-uuid";
      const STARTS_WITH = "folder/";

      // Mock the throttle manager execute function that handles API calls
      const mockExecute = vi.fn().mockResolvedValue({
        data: {
          story: { content: {} },
          rel_uuids: [TEST_UUID],
          link_uuids: [TEST_UUID],
        },
        status: 200,
      });

      client.throttleManager.execute = mockExecute;

      // Mock the resolveRelations and resolveLinks methods
      client.resolveRelations = vi.fn();
      client.resolveLinks = vi.fn();

      // Make the request with starts_with parameter
      await client.get("cdn/stories/test", {
        resolve_relations: "component.field",
        resolve_links: "1",
        starts_with: STARTS_WITH,
      });

      // Verify params were passed correctly to relation and link resolution
      expect(client.resolveRelations).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ starts_with: STARTS_WITH }),
        expect.anything(),
      );

      expect(client.resolveLinks).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ starts_with: STARTS_WITH }),
        expect.anything(),
      );
    });
  });

  // eslint-disable-next-line test/prefer-lowercase-title
  describe("ISbStoryData interface implementation", () => {
    it("should validate a complete story object structure", () => {
      const storyData: ISbStoryData = {
        alternates: [],
        content: {
          _uid: "test-uid",
          component: "test",
        },
        created_at: "2024-01-01T00:00:00.000Z",
        deleted_at: undefined,
        full_slug: "test/story",
        group_id: "test-group",
        id: 1,
        is_startpage: false,
        lang: "default",
        meta_data: {},
        name: "Test Story",
        parent_id: null,
        position: 0,
        published_at: null,
        slug: "test-story",
        sort_by_date: null,
        tag_list: [],
        uuid: "test-uuid",
      };

      expect(storyData).toBeDefined();
      expect(storyData).toMatchObject({
        alternates: expect.any(Array),
        content: expect.objectContaining({
          _uid: expect.any(String),
          component: expect.any(String),
        }),
        created_at: expect.any(String),
        full_slug: expect.any(String),
        group_id: expect.any(String),
        id: expect.any(Number),
        lang: expect.any(String),
        name: expect.any(String),
        position: expect.any(Number),
        slug: expect.any(String),
        uuid: expect.any(String),
      });
    });

    it("should handle optional properties correctly", () => {
      const storyData: ISbStoryData = {
        alternates: [],
        content: {
          _uid: "test-uid",
          component: "test",
        },
        created_at: "2024-01-01T00:00:00.000Z",
        full_slug: "test/story",
        group_id: "test-group",
        id: 1,
        lang: "default",
        meta_data: {},
        name: "Test Story",
        position: 0,
        published_at: null,
        slug: "test-story",
        sort_by_date: null,
        tag_list: [],
        uuid: "test-uuid",
        parent_id: null,
        // Optional properties
        preview_token: {
          token: "test-token",
          timestamp: "2024-01-01T00:00:00.000Z",
        },
        localized_paths: [
          {
            path: "/en/test",
            name: "Test EN",
            lang: "en",
            published: true,
          },
        ],
      };

      expect(storyData.preview_token).toBeDefined();
      expect(storyData.localized_paths).toBeDefined();
    });
  });

  describe("getStory", () => {
    it("should handle undefined resolve_relations parameter gracefully", async () => {
      const storySlug = "test-story";
      const mockStoryResponse = {
        data: {
          story: {
            id: 123,
            uuid: "test-uuid",
            name: "Test Story",
            content: {
              _uid: "test-uid",
              component: "test",
              title: "Test Title",
            },
          },
        },
        headers: {},
        status: 200,
      };

      // Mock the get method which getStory calls internally
      client.get = vi.fn().mockResolvedValue(mockStoryResponse);

      // Call getStory without resolve_relations
      const result = await client.getStory(storySlug, {
        version: "published",
        // No resolve_relations parameter
      });

      // Verify the function executed without errors
      expect(result).toEqual(mockStoryResponse);

      // Verify that get was called with the right parameters
      expect(client.get).toHaveBeenCalledWith(
        `cdn/stories/${storySlug}`,
        {
          version: "published",
          // resolve_level should not be added since resolve_relations was undefined
        },
        undefined,
      );
    });

    it("should add resolve_level when resolve_relations is provided", async () => {
      const storySlug = "test-story";
      const mockStoryResponse = {
        data: {
          story: {
            id: 123,
            uuid: "test-uuid",
            name: "Test Story",
            content: {
              _uid: "test-uid",
              component: "test",
              title: "Test Title",
            },
          },
        },
        headers: {},
        status: 200,
      };

      // Mock the get method
      client.get = vi.fn().mockResolvedValue(mockStoryResponse);

      // Call getStory with resolve_relations
      await client.getStory(storySlug, {
        version: "published",
        resolve_relations: "test.relation",
      });

      // Verify that get was called with resolve_level added
      expect(client.get).toHaveBeenCalledWith(
        `cdn/stories/${storySlug}`,
        {
          version: "published",
          resolve_relations: "test.relation",
          resolve_level: 2,
        },
        undefined,
      );
    });

    it("should decode URL-encoded resolve_relations string", async () => {
      const storySlug = "test-story";
      const mockStoryResponse = {
        data: {
          story: {
            id: 123,
            uuid: "test-uuid",
            name: "Test Story",
            content: {
              _uid: "test-uid",
              component: "test",
              title: "Test Title",
            },
          },
        },
        headers: {},
        status: 200,
      };

      const mockGet = vi.fn().mockResolvedValue(mockStoryResponse);

      // Replace the client's internal fetch instance to capture actual params
      client.client = {
        get: mockGet,
        post: vi.fn(),
        setFetchOptions: vi.fn(),
      };

      // Call get with URL-encoded resolve_relations
      await client.get(`cdn/stories/${storySlug}`, {
        version: "published",
        resolve_relations: "page.author%2Cpage.categories",
      });

      // Verify that the internal client received decoded resolve_relations
      expect(mockGet).toHaveBeenCalledWith(
        `/cdn/stories/${storySlug}`,
        expect.objectContaining({
          resolve_relations: "page.author,page.categories",
        }),
      );
    });

    it("should decode URL-encoded strings in resolve_relations array", async () => {
      const storySlug = "test-story";
      const mockStoryResponse = {
        data: {
          story: {
            id: 123,
            uuid: "test-uuid",
            name: "Test Story",
            content: {
              _uid: "test-uid",
              component: "test",
              title: "Test Title",
            },
          },
        },
        headers: {},
        status: 200,
      };

      const mockGet = vi.fn().mockResolvedValue(mockStoryResponse);

      // Replace the client's internal fetch instance to capture actual params
      client.client = {
        get: mockGet,
        post: vi.fn(),
        setFetchOptions: vi.fn(),
      };

      // Call get with URL-encoded items in resolve_relations array
      await client.get(`cdn/stories/${storySlug}`, {
        version: "published",
        resolve_relations: ["page.author", "page.categories%2Ftags"],
      });

      // Verify that the internal client received decoded and joined resolve_relations
      expect(mockGet).toHaveBeenCalledWith(
        `/cdn/stories/${storySlug}`,
        expect.objectContaining({
          resolve_relations: "page.author,page.categories/tags",
        }),
      );
    });
  });

  describe("dynamic Rate Limiting", () => {
    it("should initialize with throttle queue manager", () => {
      const client = new StoryblokClient({
        accessToken: "test-token",
      });

      expect(client).toBeDefined();
      // @ts-expect-error - accessing private property for testing
      expect(client.throttleManager).toBeDefined();
      // @ts-expect-error - accessing private property for testing
      expect(client.throttleManager.getQueueCount()).toBe(0);
    });

    it("should throttle large tier (10 req/s) correctly over time", async () => {
      vi.useFakeTimers();

      const mockData = {
        data: { stories: [] },
        headers: {},
        status: 200,
      };
      const mockGet = vi.fn().mockResolvedValue(mockData);

      const client = new StoryblokClient({
        accessToken: "test-token",
      });

      // Override the client's internal get method with our mock
      // @ts-expect-error - accessing private property for testing
      client.client.get = mockGet;

      const countCallsWithParams = (params: Record<string, string | number>) => {
        return mockGet.mock.calls.filter((call) =>
          Object.entries(params).every(([key, value]) => call[1][key] === value),
        ).length;
      };

      // Make 25 requests - should take ~3 seconds to complete all
      for (let i = 0; i < 25; i++) {
        client.get("cdn/stories", { version: "draft", per_page: 51 }).catch(() => {});
      }

      // After 999ms: exactly 10 requests should have started and completed
      await vi.advanceTimersByTimeAsync(999);
      expect(countCallsWithParams({ per_page: 51 })).toBe(10);

      // After ~2 seconds total: exactly 20 requests completed
      await vi.advanceTimersByTimeAsync(1000);
      expect(countCallsWithParams({ per_page: 51 })).toBe(20);

      // After ~3 seconds total: all 25 requests completed
      await vi.advanceTimersByTimeAsync(1000);
      expect(countCallsWithParams({ per_page: 51 })).toBe(25);

      vi.useRealTimers();
    });

    it("should throttle very large tier (6 req/s) correctly over time", async () => {
      vi.useFakeTimers();

      const mockData = {
        data: { stories: [] },
        headers: {},
        status: 200,
      };
      const mockGet = vi.fn().mockResolvedValue(mockData);

      const client = new StoryblokClient({
        accessToken: "test-token",
      });

      // Override the client's internal get method with our mock
      // @ts-expect-error - accessing private property for testing
      client.client.get = mockGet;

      const countCallsWithParams = (params: Record<string, string | number>) => {
        return mockGet.mock.calls.filter((call) =>
          Object.entries(params).every(([key, value]) => call[1][key] === value),
        ).length;
      };

      // Make 18 requests - should take ~3 seconds to complete all
      for (let i = 0; i < 18; i++) {
        client.get("cdn/stories", { version: "draft", per_page: 76 }).catch(() => {});
      }

      await vi.advanceTimersByTimeAsync(999);
      expect(countCallsWithParams({ per_page: 76 })).toBe(6);

      await vi.advanceTimersByTimeAsync(1000);
      expect(countCallsWithParams({ per_page: 76 })).toBe(12);

      await vi.advanceTimersByTimeAsync(1000);
      expect(countCallsWithParams({ per_page: 76 })).toBe(18);

      vi.useRealTimers();
    });

    it("should throttle different rate limit tiers independently", async () => {
      vi.useFakeTimers();

      const mockData = {
        data: { stories: [] },
        headers: {},
        status: 200,
      };
      const mockGet = vi.fn().mockResolvedValue(mockData);

      const client = new StoryblokClient({
        accessToken: "test-token",
      });

      // Override the client's internal get method with our mock
      // @ts-expect-error - accessing private property for testing
      client.client.get = mockGet;

      const countCallsWithParams = (params: Record<string, string | number>) => {
        return mockGet.mock.calls.filter((call) =>
          Object.entries(params).every(([key, value]) => call[1][key] === value),
        ).length;
      };

      // Make simultaneous requests to very large (6 req/s) and published (1000 req/s) tiers
      for (let i = 0; i < 12; i++) {
        client.get("cdn/stories", { version: "draft", per_page: 76 }).catch(() => {});
      }
      for (let i = 0; i < 50; i++) {
        client.get("cdn/stories", { version: "published" }).catch(() => {});
      }

      // After 999ms:
      // - Published tier (1000 req/s) should complete all 50 immediately
      // - Very large tier (6 req/s) should have exactly 6 completed
      await vi.advanceTimersByTimeAsync(999);
      expect(countCallsWithParams({ version: "published" })).toBe(50);
      expect(countCallsWithParams({ per_page: 76 })).toBe(6);

      // After ~2 seconds: very large tier should have 12 completed (not affected by published load)
      await vi.advanceTimersByTimeAsync(1000);
      expect(countCallsWithParams({ per_page: 76 })).toBe(12);

      vi.useRealTimers();
    });

    it("should respect server rate limit headers when present", async () => {
      // Override the global sbFetch mock for this test to return proper headers
      const mockData = {
        data: { stories: [] },
        headers: {
          "x-ratelimit-policy": '"concurrent-requests";q=100',
        },
        status: 200,
      };
      const mockGet = vi.fn().mockResolvedValueOnce(mockData).mockResolvedValueOnce(mockData);

      const client = new StoryblokClient({
        accessToken: "test-token",
      });

      // Override the client's internal get method with our mock
      // @ts-expect-error - accessing private property for testing
      client.client.get = mockGet;

      // First request establishes the server rate limit from headers
      // This will use automatic tier (15 req/s for per_page=50)
      await client.get("cdn/stories", { version: "draft", per_page: 50 });

      // @ts-expect-error - accessing private property for testing
      let queues = client.throttleManager.queues;
      expect(queues.size).toBe(1);
      expect(queues.has(15)).toBe(true); // First request used automatic tier

      // Second request should now use server rate limit (100 req/s)
      // from the first response headers
      await client.get("cdn/stories", { version: "draft", per_page: 50 });

      // @ts-expect-error - accessing private property for testing
      queues = client.throttleManager.queues;

      // Should now have created a queue with 100 req/s (from server header)
      // The 15 req/s queue from first request should still exist
      expect(queues.size).toBe(2);
      expect(queues.has(100)).toBe(true); // Second request used server rate limit
      expect(queues.has(15)).toBe(true); // First request queue still exists
    });

    it("should apply user rate limit to all requests", async () => {
      // Override the global sbFetch mock for this test
      const mockData = {
        data: { stories: [] },
        headers: {},
        status: 200,
      };
      const mockGet = vi.fn().mockResolvedValueOnce(mockData).mockResolvedValueOnce(mockData);

      const client = new StoryblokClient({
        accessToken: "test-token",
        rateLimit: 20, // User overrides to 20 req/s
      });

      // Override the client's internal get method with our mock
      // @ts-expect-error - accessing private property for testing
      client.client.get = mockGet;

      // Make a draft request with 100 items (would normally be 6 req/s tier)
      // User rate limit (20 req/s) should take precedence over automatic tier (6 req/s)
      await client.get("cdn/stories", { version: "draft", per_page: 100 });

      // Should have created only one queue with 20 req/s (user rate limit)
      // NOT 6 req/s (automatic tier)
      // @ts-expect-error - accessing private property for testing
      let queues = client.throttleManager.queues;

      expect(queues.size).toBe(1);
      expect(queues.has(20)).toBe(true);
      expect(queues.has(6)).toBe(false);

      await client.get("cdn/stories", { version: "published", per_page: 100 });
      // Should still have only one queue:
      // - 20 req/s for both draft and published (user limit applies to all)
      // @ts-expect-error - accessing private property for testing
      queues = client.throttleManager.queues;

      expect(queues.size).toBe(1);
      expect(queues.has(20)).toBe(true);
      expect(queues.has(1000)).toBe(false); // Should NOT use automatic 1000 req/s
      expect(queues.has(6)).toBe(false); // Should never use automatic 6 req/s
    });

    it("should use rate limit of 3 req/s for Management API requests", async () => {
      vi.useFakeTimers();

      const mockData = {
        data: { story: { name: "Test Story", id: 123 } },
        headers: {},
        status: 200,
      };
      const mockGet = vi.fn().mockResolvedValue(mockData);

      const client = new StoryblokClient({
        oauthToken: "test-oauth-token",
      });

      // Override the client's internal get method with our mock
      // @ts-expect-error - accessing private property for testing
      client.client.get = mockGet;

      // Make 9 Management API requests (should take ~3 seconds at 3 req/s)
      for (let i = 0; i < 9; i++) {
        client.get(`spaces/123/stories/${i}`).catch(() => {});
      }

      // After 999ms: exactly 3 requests should have started (3 req/s)
      await vi.advanceTimersByTimeAsync(999);
      expect(mockGet).toHaveBeenCalledTimes(3);

      // After another 1000ms (total 1999ms): 6 requests total
      await vi.advanceTimersByTimeAsync(1000);
      expect(mockGet).toHaveBeenCalledTimes(6);

      // After another 1000ms (total 2999ms): all 9 requests complete
      await vi.advanceTimersByTimeAsync(1000);
      expect(mockGet).toHaveBeenCalledTimes(9);

      // Verify the queue was created with rate limit of 3
      // @ts-expect-error - accessing private property for testing
      const queues = client.throttleManager.queues;
      expect(queues.size).toBe(1);
      expect(queues.has(3)).toBe(true); // Management API default rate limit
      expect(queues.has(1000)).toBe(false); // Should NOT use CDN cached rate limit

      vi.useRealTimers();
    });

    it("should use different queues for CDN and Management API requests", async () => {
      vi.useFakeTimers();

      const mockData = {
        data: { stories: [], story: { name: "Test" } },
        headers: {},
        status: 200,
      };
      const mockGet = vi.fn().mockResolvedValue(mockData);

      const client = new StoryblokClient({
        accessToken: "test-token",
        oauthToken: "test-oauth-token",
      });

      // Override the client's internal get method with our mock
      // @ts-expect-error - accessing private property for testing
      client.client.get = mockGet;

      // Make simultaneous CDN (50 req/s for draft) and MAPI (3 req/s) requests
      for (let i = 0; i < 6; i++) {
        client.get("cdn/stories", { version: "draft" }).catch(() => {});
      }
      for (let i = 0; i < 6; i++) {
        client.get("spaces/123/stories/456").catch(() => {});
      }

      // After 999ms:
      // - CDN queue (50 req/s): all 6 requests should complete
      // - MAPI queue (3 req/s): only 3 requests should complete
      await vi.advanceTimersByTimeAsync(999);
      expect(mockGet).toHaveBeenCalledTimes(9); // 6 CDN + 3 MAPI

      // After another 1000ms: remaining 3 MAPI requests complete
      await vi.advanceTimersByTimeAsync(1000);
      expect(mockGet).toHaveBeenCalledTimes(12); // All 12 requests

      // Verify separate queues were created
      // @ts-expect-error - accessing private property for testing
      const queues = client.throttleManager.queues;
      expect(queues.size).toBe(2);
      expect(queues.has(50)).toBe(true); // CDN draft rate limit
      expect(queues.has(3)).toBe(true); // Management API rate limit

      vi.useRealTimers();
    });

    it("should support timeout configuration through StoryblokClient", async () => {
      // Integration test to verify timeout works end-to-end
      vi.doUnmock("../src/sbFetch");
      const { default: RealSbFetch } = await import("./sbFetch");

      const mockFetch = vi.fn((_url: string, options?: any): Promise<Response> => {
        return new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            resolve(new Response(JSON.stringify({ stories: [] }), { status: 200 }));
          }, 5000);

          options?.signal?.addEventListener("abort", () => {
            clearTimeout(timeoutId);
            const error = new Error("The operation was aborted");
            error.name = "AbortError";
            reject(error);
          });
        });
      });

      const client = new StoryblokClient({
        accessToken: "test",
        timeout: 1,
      });

      (client as any).client = new RealSbFetch({
        baseURL: "https://api.storyblok.com/v2",
        timeout: 1,
        headers: new Headers(),
        fetch: mockFetch as any,
      });

      await expect(client.get("cdn/stories")).rejects.toMatchObject({
        message: "Request timeout: The request was aborted due to timeout",
      });

      vi.doMock("../src/sbFetch");
    }, 3000);
  });

  describe("version param on non-CDN URLs", () => {
    it("strips version from params when calling a Management API endpoint", async () => {
      vi.doUnmock("../src/sbFetch");
      const { default: RealSbFetch } = await import("./sbFetch");

      const capturedUrls: string[] = [];
      const mockFetch = vi.fn((url: string): Promise<Response> => {
        capturedUrls.push(url);
        return Promise.resolve(
          new Response(JSON.stringify({ story: { id: 123 } }), { status: 200 }),
        );
      });

      const mapiClient = new StoryblokClient({ oauthToken: "test-management-token" });
      (mapiClient as any).client = new RealSbFetch({
        baseURL: "https://mapi.storyblok.com/v1",
        headers: new Headers(),
        fetch: mockFetch as any,
      });

      await mapiClient.get("spaces/123/stories/456", { version: "draft" } as any);

      expect(capturedUrls[0]).not.toContain("version");

      vi.doMock("../src/sbFetch");
    });
  });
});
