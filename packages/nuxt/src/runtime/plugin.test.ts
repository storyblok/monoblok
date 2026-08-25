import { beforeEach, describe, expect, it, vi } from "vitest";

const mockConfig: any = { public: { storyblok: {} } };

const { apiPluginMarker, storyblokVueMarker } = vi.hoisted(() => ({
  apiPluginMarker: Symbol("apiPlugin"),
  storyblokVueMarker: Symbol("StoryblokVue"),
}));

vi.mock("#app", () => ({
  defineNuxtPlugin: (setup: (ctx: { vueApp: { use: (...args: unknown[]) => void } }) => void) =>
    setup,
  useRuntimeConfig: () => mockConfig,
}));

vi.mock("@storyblok/vue", () => ({
  apiPlugin: apiPluginMarker,
  StoryblokVue: storyblokVueMarker,
}));

import plugin from "./plugin";

describe("storyblok nuxt plugin", () => {
  beforeEach(() => {
    mockConfig.public.storyblok = {};
  });

  it("registers apiPlugin when enableServerClient is false", () => {
    mockConfig.public.storyblok = { enableServerClient: false, componentsDir: "~/storyblok" };
    const use = vi.fn();

    (plugin as any)({ vueApp: { use } });

    expect(use).toHaveBeenCalledTimes(1);
    const [target, options] = use.mock.calls[0]!;
    expect(target).toBe(storyblokVueMarker);
    expect(options).toMatchObject({ enableServerClient: false, componentsDir: "~/storyblok" });
    expect(options.use).toEqual([apiPluginMarker]);
  });

  it("does not register apiPlugin when enableServerClient is true", () => {
    mockConfig.public.storyblok = { enableServerClient: true };
    const use = vi.fn();

    (plugin as any)({ vueApp: { use } });

    const [, options] = use.mock.calls[0]!;
    expect(options.use).toBeUndefined();
  });

  it("does not mutate or replace the runtime config object (regression: no JSON clone)", () => {
    const original = { enableServerClient: false, nested: { a: 1 } };
    mockConfig.public.storyblok = original;

    (plugin as any)({ vueApp: { use: vi.fn() } });

    expect(mockConfig.public.storyblok).toBe(original);
  });
});
