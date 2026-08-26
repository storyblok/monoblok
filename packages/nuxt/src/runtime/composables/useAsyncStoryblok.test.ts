import { beforeEach, describe, expect, it, vi } from "vitest";

const ref = <T>(value: T) => ({ value });

const mockRuntimeConfig: any = { public: { storyblok: { accessToken: "test-token" } } };

const { apiGet, useStoryblokBridge } = vi.hoisted(() => ({
  apiGet: vi.fn(async () => ({
    data: { cv: 1, links: [], rels: [], story: { id: 1, content: {} } },
    headers: {},
  })),
  useStoryblokBridge: vi.fn(),
}));

vi.mock("#app", () => ({
  useAsyncData: vi.fn(async (_key: unknown, fetcher: () => Promise<unknown>) => ({
    data: ref(await fetcher()),
    pending: ref(false),
    error: ref(undefined),
    refresh: vi.fn(),
    execute: vi.fn(),
    clear: vi.fn(),
  })),
  useRuntimeConfig: () => mockRuntimeConfig,
}));

vi.mock("@storyblok/vue", () => ({
  useStoryblokApi: () => ({ get: apiGet }),
  useStoryblokBridge,
}));

// Fakes just enough of Vue's API for this composable's own usage (a getter-backed
// `computed`, an immediate-only `watch`, and a passthrough `toValue`) so the test
// doesn't need `vue` resolvable as a package of its own.
vi.mock("vue", () => ({
  computed: (getter: () => unknown) => ({
    get value() {
      return getter();
    },
  }),
  toValue: (value: unknown) => (typeof value === "function" ? (value as () => unknown)() : value),
  watch: (
    source: () => unknown,
    callback: (value: unknown) => void,
    options?: { immediate?: boolean },
  ) => {
    if (options?.immediate) {
      callback(source());
    }
    return () => {};
  },
}));

import { useAsyncStoryblok } from "./useAsyncStoryblok";
import { useAsyncData } from "#app";

describe("useAsyncStoryblok", () => {
  beforeEach(() => {
    mockRuntimeConfig.public.storyblok = { accessToken: "test-token" };
    apiGet.mockClear();
    useStoryblokBridge.mockClear();
  });

  it("throws when the access token is not available client-side (regression)", async () => {
    mockRuntimeConfig.public.storyblok = { accessToken: "" };

    await expect(useAsyncStoryblok("home", { api: {} })).rejects.toThrow(/access token/i);
  });

  it("registers the bridge by default when omitted", async () => {
    await useAsyncStoryblok("home", { api: { version: "draft" } });

    // `import.meta.client` is stubbed truthy in vite.config.ts's `define` for this suite.
    await vi.waitFor(() => expect(useStoryblokBridge).toHaveBeenCalledTimes(1));
  });

  it("does not register the bridge when bridge is explicitly false (regression)", async () => {
    await useAsyncStoryblok("home", { api: { version: "draft" }, bridge: false });

    // give any pending watcher a tick to fire, if it were going to
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(useStoryblokBridge).not.toHaveBeenCalled();
  });

  it("inherits resolve_relations/resolve_links from api options when bridge omits them", async () => {
    await useAsyncStoryblok("home", {
      api: {
        version: "draft",
        resolve_relations: "author",
        resolve_links: "url",
      },
    });

    await vi.waitFor(() => expect(useStoryblokBridge).toHaveBeenCalledTimes(1));
    const bridgeOptions = useStoryblokBridge.mock.calls[0]![2];
    expect(bridgeOptions).toMatchObject({
      resolveRelations: "author",
      resolveLinks: "url",
    });
  });

  it("separates the url and stringified api params in the cache key (regression)", async () => {
    await useAsyncStoryblok("home", { api: { version: "draft" } });
    const key = (vi.mocked(useAsyncData).mock.calls[0]![0] as () => string)();

    expect(key.startsWith("home::")).toBe(true);
  });

  it("lets an explicit bridge option override the api-derived defaults", async () => {
    await useAsyncStoryblok("home", {
      api: { version: "draft", resolve_relations: "author" },
      bridge: { resolveRelations: ["editor"] },
    });

    await vi.waitFor(() => expect(useStoryblokBridge).toHaveBeenCalledTimes(1));
    const bridgeOptions = useStoryblokBridge.mock.calls[0]![2];
    expect(bridgeOptions.resolveRelations).toEqual(["editor"]);
  });
});
