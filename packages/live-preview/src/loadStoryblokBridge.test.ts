import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BridgeParams } from "@storyblok/preview-bridge";

// ---- mocks ----

const constructorMock = vi.fn();

vi.mock("@storyblok/preview-bridge", () => {
  class MockStoryblokBridge {
    constructor(config?: BridgeParams) {
      constructorMock(config);
    }
  }

  return {
    default: MockStoryblokBridge,
  };
});

describe("loadStoryblokBridge", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    // Suppress (and capture) console.warn globally — individual tests assert
    // specific messages where needed.
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    Object.defineProperty(window, "location", {
      value: {
        href: "http://localhost/?_storyblok=123&_storyblok_c=456&_storyblok_tk[space_id]=789",
        search: "?_storyblok=123&_storyblok_c=456&_storyblok_tk[space_id]=789",
      },
      writable: true,
    });
  });

  afterEach(() => {
    warnSpy.mockRestore();
    delete (window as any).StoryblokBridge;
    delete (window as any).storyblokRegisterEvent;
  });

  it("creates a bridge instance with the supplied config", async () => {
    const { loadStoryblokBridge } = await import("./loadStoryblokBridge");

    const config: BridgeParams = { resolveRelations: ["foo.bar"] };

    const bridge = await loadStoryblokBridge(config);

    expect(bridge).toBeDefined();
    expect(constructorMock).toHaveBeenCalledOnce();
    expect(constructorMock).toHaveBeenCalledWith(config);
  });

  it("creates a new instance on every call", async () => {
    const { loadStoryblokBridge } = await import("./loadStoryblokBridge");

    const first = await loadStoryblokBridge();
    const second = await loadStoryblokBridge();

    expect(first).not.toBe(second);
    expect(constructorMock).toHaveBeenCalledTimes(2);
  });

  it("accepts different configs on subsequent calls without throwing", async () => {
    const { loadStoryblokBridge } = await import("./loadStoryblokBridge");

    const configA: BridgeParams = { resolveRelations: ["foo.bar"] };
    const configB: BridgeParams = { resolveRelations: ["bar.foo"] };

    await expect(loadStoryblokBridge(configA)).resolves.toBeDefined();
    await expect(loadStoryblokBridge(configB)).resolves.toBeDefined();

    expect(constructorMock).toHaveBeenCalledTimes(2);
  });

  it("sets window.StoryblokBridge to the bridge class", async () => {
    const { loadStoryblokBridge } = await import("./loadStoryblokBridge");

    expect((window as any).StoryblokBridge).toBeUndefined();

    await loadStoryblokBridge();

    expect((window as any).StoryblokBridge).toBeDefined();
    expect(typeof (window as any).StoryblokBridge).toBe("function");
  });

  it("window.StoryblokBridge emits a deprecation warning on access", async () => {
    const { loadStoryblokBridge } = await import("./loadStoryblokBridge");

    await loadStoryblokBridge();
    void (window as any).StoryblokBridge;

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "`window.StoryblokBridge` is deprecated and will be removed in a future version.",
      ),
    );
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("loadStoryblokBridge"));
  });

  it("sets window.storyblokRegisterEvent", async () => {
    const { loadStoryblokBridge } = await import("./loadStoryblokBridge");

    await loadStoryblokBridge();

    expect(typeof window.storyblokRegisterEvent).toBe("function");
  });

  it("window.storyblokRegisterEvent emits a deprecation warning on access", async () => {
    const { loadStoryblokBridge } = await import("./loadStoryblokBridge");

    await loadStoryblokBridge();
    void window.storyblokRegisterEvent;

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "`window.storyblokRegisterEvent` is deprecated and will be removed in a future version.",
      ),
    );
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("onStoryblokEditorEvent"));
  });

  it("storyblokRegisterEvent calls cb immediately when in editor", async () => {
    const { loadStoryblokBridge } = await import("./loadStoryblokBridge");

    await loadStoryblokBridge();

    const cb = vi.fn();
    window.storyblokRegisterEvent(cb);

    expect(cb).toHaveBeenCalledOnce();
  });

  it("storyblokRegisterEvent warns and does not call cb when not in editor", async () => {
    Object.defineProperty(window, "location", {
      value: { href: "http://localhost/", search: "" },
      writable: true,
    });

    const { loadStoryblokBridge } = await import("./loadStoryblokBridge");

    await loadStoryblokBridge();

    const cb = vi.fn();
    window.storyblokRegisterEvent(cb);

    expect(cb).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      "[Storyblok] You are not in Draft Mode or in the Visual Editor.",
    );
  });

  it("throws when called in a server-side environment", async () => {
    const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");

    Object.defineProperty(globalThis, "window", {
      value: undefined,
      writable: true,
      configurable: true,
    });

    try {
      const { loadStoryblokBridge } = await import("./loadStoryblokBridge");
      await expect(loadStoryblokBridge()).rejects.toThrow(
        "Cannot load Storyblok bridge: window is undefined",
      );
    } finally {
      if (windowDescriptor) {
        Object.defineProperty(globalThis, "window", windowDescriptor);
      }
    }
  });

  it("propagates import errors", async () => {
    vi.doMock("@storyblok/preview-bridge", () => {
      throw new Error("import failed");
    });

    const { loadStoryblokBridge: failingLoader } = await import("./loadStoryblokBridge");

    await expect(failingLoader()).rejects.toThrow();
  });
});
