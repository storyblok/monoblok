import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { apiPlugin } from "@storyblok/js";
import type { SbReactSDKOptions } from "../types";

type InitModule = typeof import("../core/init");

// Each test gets a fresh copy of the init module, so module-level state
// (API instance, components, fallback settings) cannot leak between tests.
let init: InitModule;

beforeEach(async () => {
  vi.resetModules();
  init = await import("../core/init");
});

describe("storyblokInit", () => {
  let pluginOptions: SbReactSDKOptions;

  beforeEach(() => {
    pluginOptions = {
      accessToken: "test-token",
      use: [apiPlugin],
      components: { testComponent: () => null },
      enableFallbackComponent: true,
      customFallbackComponent: () => null,
    };
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it("should initialize storyblokApiInstance", () => {
    init.storyblokInit(pluginOptions);
    const storyblokApi = init.getStoryblokApi();
    expect(storyblokApi).toBeDefined();
  });

  it("should set componentsMap", () => {
    init.storyblokInit(pluginOptions);
    expect(pluginOptions.components).toHaveProperty("testComponent");
  });

  it("should set enableFallbackComponent", () => {
    init.storyblokInit(pluginOptions);
    expect(init.getEnableFallbackComponent()).toBe(true);
  });

  it("should set customFallbackComponent", () => {
    init.storyblokInit(pluginOptions);
    expect(init.getCustomFallbackComponent()).toBeDefined();
  });

  it("should re-register components and fallback options when called again with an existing instance", () => {
    init.storyblokInit(pluginOptions);
    const updatedComponent = () => null;
    const updatedFallback = () => null;
    init.storyblokInit({
      ...pluginOptions,
      components: { testComponent: updatedComponent },
      enableFallbackComponent: false,
      customFallbackComponent: updatedFallback,
    });
    expect(init.getComponent("testComponent")).toBe(updatedComponent);
    expect(init.getEnableFallbackComponent()).toBe(false);
    expect(init.getCustomFallbackComponent()).toBe(updatedFallback);
  });
});

describe("setComponents", () => {
  it("should set components map", () => {
    const components = { testComponent: () => null };
    init.setComponents(components);
    expect(init.getComponent("testComponent")).toBe(components.testComponent);
  });
});

describe("getComponent", () => {
  it("should return the component if it exists", () => {
    const components = { testComponent: () => null };
    init.setComponents(components);
    expect(init.getComponent("testComponent")).toBe(components.testComponent);
  });

  it("should return false if the component does not exist", () => {
    expect(init.getComponent("nonExistentComponent")).toBe(false);
  });

  it("should return false if the component does not exist and log a message", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(init.getComponent("nonExistentComponent")).toBe(false);
    expect(consoleSpy).toHaveBeenCalledWith("Component nonExistentComponent doesn't exist.");
    consoleSpy.mockRestore();
  });
});
