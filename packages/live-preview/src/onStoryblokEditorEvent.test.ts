import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BridgeParams } from "@storyblok/preview-bridge";
import type StoryblokBridge from "@storyblok/preview-bridge";

// ---- mocks ----

vi.mock("./utils/isBrowser", () => ({ isBrowser: vi.fn() }));
vi.mock("./utils/isInEditor", () => ({ isInEditor: vi.fn() }));

const onMock = vi.fn();
const destroyMock = vi.fn();

vi.mock("./loadStoryblokBridge", () => ({
  loadStoryblokBridge: vi.fn(async () => ({ on: onMock, destroy: destroyMock })),
  preloadStoryblokBridge: vi.fn(async () => undefined),
}));

import { isBrowser } from "./utils/isBrowser";
import { isInEditor } from "./utils/isInEditor";
import { loadStoryblokBridge } from "./loadStoryblokBridge";
import { onStoryblokEditorEvent } from "./onStoryblokEditorEvent";

/** Advances several microtask ticks — enough for a chain of `.then()`s to settle. */
async function flushMicrotasks(times = 5): Promise<void> {
  for (let i = 0; i < times; i++) {
    await Promise.resolve();
  }
}

describe("onStoryblokEditorEvent", () => {
  const activeCleanups: (() => void)[] = [];

  async function subscribe(
    callback: Parameters<typeof onStoryblokEditorEvent>[0],
    options?: BridgeParams,
  ): Promise<() => void> {
    const cleanup = await onStoryblokEditorEvent(callback, options);
    activeCleanups.push(cleanup);
    return cleanup;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadStoryblokBridge).mockImplementation(
      async () =>
        ({
          on: onMock,
          destroy: destroyMock,
        }) as unknown as StoryblokBridge,
    );
    Object.defineProperty(window, "location", {
      value: { reload: vi.fn(), href: "http://localhost/" },
      writable: true,
    });
  });

  afterEach(() => {
    for (const cleanup of activeCleanups) cleanup();
    activeCleanups.length = 0;
    vi.restoreAllMocks();
  });

  function inEditor() {
    vi.mocked(isBrowser).mockReturnValue(true);
    vi.mocked(isInEditor).mockReturnValue(true);
  }

  it("returns a no-op cleanup when not in browser", async () => {
    vi.mocked(isBrowser).mockReturnValue(false);

    const cleanup = await subscribe(vi.fn());

    expect(loadStoryblokBridge).not.toHaveBeenCalled();
    expect(cleanup).toBeTypeOf("function");
  });

  it("returns a no-op cleanup when not in editor", async () => {
    vi.mocked(isBrowser).mockReturnValue(true);
    vi.mocked(isInEditor).mockReturnValue(false);

    const cleanup = await subscribe(vi.fn());

    expect(loadStoryblokBridge).not.toHaveBeenCalled();
    expect(cleanup).toBeTypeOf("function");
  });

  it("passes bridgeOptions to loadStoryblokBridge", async () => {
    inEditor();

    const config: BridgeParams = { resolveRelations: ["foo.bar"] };
    await subscribe(vi.fn(), config);

    expect(loadStoryblokBridge).toHaveBeenCalledWith({ ...config, initOnlyOnce: false });
  });

  it("shares one bridge for different relation options and merges them", async () => {
    inEditor();

    const [cleanup1, cleanup2] = await Promise.all([
      subscribe(vi.fn(), { resolveRelations: ["a.b"] }),
      subscribe(vi.fn(), { resolveRelations: ["c.d"] }),
    ]);

    expect(loadStoryblokBridge).toHaveBeenCalledTimes(1);
    expect(loadStoryblokBridge).toHaveBeenCalledWith({
      resolveRelations: ["a.b", "c.d"],
      initOnlyOnce: false,
    });
    cleanup1();
    cleanup2();
  });

  it("reconfigures the active bridge when a later subscriber adds relations", async () => {
    inEditor();

    const cleanup1 = await subscribe(vi.fn(), { resolveRelations: ["a.b"] });
    const cleanup2 = await subscribe(vi.fn(), { resolveRelations: ["c.d"] });

    expect(loadStoryblokBridge).toHaveBeenCalledTimes(2);
    expect(loadStoryblokBridge).toHaveBeenLastCalledWith({
      resolveRelations: ["a.b", "c.d"],
      initOnlyOnce: false,
    });
    expect(destroyMock).toHaveBeenCalledOnce();

    cleanup1();
    cleanup2();
  });

  it("destroys the previous bridge before constructing its replacement", async () => {
    inEditor();

    const calls: string[] = [];
    vi.mocked(loadStoryblokBridge).mockImplementation(async () => {
      calls.push("build");
      return { on: onMock, destroy: () => calls.push("destroy") } as unknown as StoryblokBridge;
    });

    const cleanup1 = await subscribe(vi.fn(), { resolveRelations: ["a.b"] });
    const cleanup2 = await subscribe(vi.fn(), { resolveRelations: ["c.d"] });

    // Never "build, build, destroy" — the previous bridge is always gone
    // before the next one is constructed.
    expect(calls).toEqual(["build", "destroy", "build"]);

    cleanup1();
    cleanup2();
  });

  it("reuses the same bridge for identical options", async () => {
    inEditor();

    const cleanup1 = await subscribe(vi.fn(), { resolveRelations: ["a.b"] });
    const cleanup2 = await subscribe(vi.fn(), { resolveRelations: ["a.b"] });

    expect(loadStoryblokBridge).toHaveBeenCalledTimes(1);
    cleanup1();
    cleanup2();
  });

  it("reuses the same bridge when no options are supplied", async () => {
    inEditor();

    const cleanup1 = await subscribe(vi.fn());
    const cleanup2 = await subscribe(vi.fn());

    expect(loadStoryblokBridge).toHaveBeenCalledTimes(1);
    cleanup1();
    cleanup2();
  });

  it("does not rebuild when subscribing with the same relations in a different order", async () => {
    inEditor();

    const cleanup1 = await subscribe(vi.fn(), { resolveRelations: ["a.b", "c.d"] });
    const cleanup2 = await subscribe(vi.fn(), { resolveRelations: ["c.d", "a.b"] });

    expect(loadStoryblokBridge).toHaveBeenCalledTimes(1);
    cleanup1();
    cleanup2();
  });

  it("forces initOnlyOnce off for every shared bridge", async () => {
    inEditor();

    const cleanup1 = await subscribe(vi.fn(), { initOnlyOnce: true });
    const cleanup2 = await subscribe(vi.fn(), { initOnlyOnce: false });
    const cleanup3 = await subscribe(vi.fn());

    // initOnlyOnce does not affect sharing — all three share one bridge.
    expect(loadStoryblokBridge).toHaveBeenCalledTimes(1);
    expect(loadStoryblokBridge).toHaveBeenCalledWith({ initOnlyOnce: false });
    cleanup1();
    cleanup2();
    cleanup3();
  });

  it("keeps the first scalar option when later subscribers conflict", async () => {
    inEditor();

    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const cleanup1 = await subscribe(vi.fn(), { fallbackLang: "en" });
    const cleanup2 = await subscribe(vi.fn(), { fallbackLang: "de" });

    expect(loadStoryblokBridge).toHaveBeenLastCalledWith({
      fallbackLang: "en",
      initOnlyOnce: false,
    });
    expect(warning).toHaveBeenCalledWith(
      '[Storyblok] Conflicting live preview option "fallbackLang" ignored; using the first value.',
    );
    cleanup1();
    cleanup2();
  });

  it("warns about a conflicting scalar only once per key, not on every cycle", async () => {
    inEditor();

    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const cleanupA = await subscribe(vi.fn(), { fallbackLang: "en" });
    const cleanupB = await subscribe(vi.fn(), { fallbackLang: "de" });
    cleanupB();
    const cleanupC = await subscribe(vi.fn(), { fallbackLang: "fr" });

    const fallbackLangWarnings = warning.mock.calls.filter(([message]) =>
      String(message).includes('"fallbackLang"'),
    );
    expect(fallbackLangWarnings).toHaveLength(1);

    cleanupA();
    cleanupC();
  });

  it("lets an explicit preventClicks: true win over an earlier preventClicks: false", async () => {
    inEditor();

    const cleanup1 = await subscribe(vi.fn(), { preventClicks: false });
    const cleanup2 = await subscribe(vi.fn(), { preventClicks: true });

    expect(loadStoryblokBridge).toHaveBeenLastCalledWith({
      preventClicks: true,
      initOnlyOnce: false,
    });
    cleanup1();
    cleanup2();
  });

  it("lets preventClicks: true win regardless of subscribe order", async () => {
    inEditor();

    const cleanup1 = await subscribe(vi.fn(), { preventClicks: true });
    const cleanup2 = await subscribe(vi.fn(), { preventClicks: false });

    expect(loadStoryblokBridge).toHaveBeenLastCalledWith({
      preventClicks: true,
      initOnlyOnce: false,
    });
    cleanup1();
    cleanup2();
  });

  it("keeps preventClicks: true on the live bridge until the next rebuild, then drops it", async () => {
    inEditor();

    const cleanup1 = await subscribe(vi.fn(), { preventClicks: true });
    const cleanup2 = await subscribe(vi.fn(), { preventClicks: false });
    cleanup1();
    await flushMicrotasks();

    // Cleanup alone doesn't rebuild — A's contribution stays live until
    // something else triggers a rebuild.
    expect(loadStoryblokBridge).toHaveBeenLastCalledWith({
      preventClicks: true,
      initOnlyOnce: false,
    });

    await subscribe(vi.fn());
    expect(loadStoryblokBridge).toHaveBeenLastCalledWith({
      preventClicks: false,
      initOnlyOnce: false,
    });
    cleanup2();
  });

  it("normalizes comma-separated relation options", async () => {
    inEditor();

    await subscribe(vi.fn(), {
      resolveRelations: "article.author,page.hero" as unknown as string[],
    });

    expect(loadStoryblokBridge).toHaveBeenCalledWith({
      resolveRelations: ["article.author", "page.hero"],
      initOnlyOnce: false,
    });
  });

  it("treats null scalar options as unset", async () => {
    inEditor();

    await subscribe(vi.fn(), { customParent: null });
    await subscribe(vi.fn(), { customParent: "https://example.com" });

    expect(loadStoryblokBridge).toHaveBeenLastCalledWith({
      customParent: "https://example.com",
      initOnlyOnce: false,
    });
  });

  it("drops an unparsable customParent instead of throwing, and keeps a later valid one", async () => {
    inEditor();

    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const cleanup1 = await subscribe(vi.fn(), { customParent: "app.storyblok.com" });
    const cleanup2 = await subscribe(vi.fn(), { customParent: "https://example.com" });

    expect(loadStoryblokBridge).toHaveBeenLastCalledWith({
      customParent: "https://example.com",
      initOnlyOnce: false,
    });
    expect(warning).toHaveBeenCalledWith(
      '[Storyblok] Live preview option "customParent" ignored: "app.storyblok.com" is not an absolute URL.',
    );

    cleanup1();
    cleanup2();
  });

  it("calls callback on input event", async () => {
    inEditor();

    const cb = vi.fn();
    await subscribe(cb);

    const handler = onMock.mock.calls[0][1];
    handler({ action: "input", story: { id: 42 } });

    expect(cb).toHaveBeenCalledWith(expect.objectContaining({ id: 42 }));
  });

  it("fans out to all subscribers sharing the same bridge", async () => {
    inEditor();

    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const cleanup1 = await subscribe(cb1, { resolveRelations: ["a.b"] });
    const cleanup2 = await subscribe(cb2, { resolveRelations: ["a.b"] });

    const handler = onMock.mock.calls[0][1];
    handler({ action: "input", story: { id: 7 } });

    expect(cb1).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }));
    expect(cb2).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }));
    cleanup1();
    cleanup2();
  });

  // A subscriber that arrives after the first bridge resolved forces a rebuild.
  // The earlier subscriber is only reachable from the rebuilt bridge, because
  // the previous one is destroyed. Regression guard for sequential mounts,
  // which the same-tick fan-out test above cannot reach.
  it("fans out to every subscriber from the rebuilt bridge", async () => {
    inEditor();

    const onFirstBridge = vi.fn();
    const onRebuiltBridge = vi.fn();
    vi.mocked(loadStoryblokBridge)
      .mockResolvedValueOnce({
        on: onFirstBridge,
        destroy: destroyMock,
      } as unknown as StoryblokBridge)
      .mockResolvedValueOnce({
        on: onRebuiltBridge,
        destroy: destroyMock,
      } as unknown as StoryblokBridge);

    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const cleanup1 = await subscribe(cb1, { resolveRelations: ["a.b"] });
    const cleanup2 = await subscribe(cb2, { resolveRelations: ["c.d"] });

    expect(loadStoryblokBridge).toHaveBeenCalledTimes(2);
    expect(loadStoryblokBridge).toHaveBeenLastCalledWith({
      resolveRelations: ["a.b", "c.d"],
      initOnlyOnce: false,
    });

    const handler = onRebuiltBridge.mock.calls[0][1];
    handler({ action: "input", story: { id: 9 } });

    expect(cb1).toHaveBeenCalledWith(expect.objectContaining({ id: 9 }));
    expect(cb2).toHaveBeenCalledWith(expect.objectContaining({ id: 9 }));
    cleanup1();
    cleanup2();
  });

  it("does not call callback after cleanup", async () => {
    inEditor();

    const cb = vi.fn();
    const cleanup = await subscribe(cb);
    cleanup();

    const handler = onMock.mock.calls[0][1];
    handler({ action: "input", story: { id: 1 } });

    expect(cb).not.toHaveBeenCalled();
  });

  it("does not call cleaned-up callback but still calls remaining subscriber", async () => {
    inEditor();

    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const cleanup1 = await subscribe(cb1);
    const cleanup2 = await subscribe(cb2);
    cleanup1();

    const handler = onMock.mock.calls[0][1];
    handler({ action: "input", story: { id: 5 } });

    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).toHaveBeenCalledWith(expect.objectContaining({ id: 5 }));
    cleanup2();
  });

  it("does not destroy a shared bridge when the same callback cleans up one subscription", async () => {
    inEditor();

    const callback = vi.fn();
    const cleanup1 = await subscribe(callback);
    const cleanup2 = await subscribe(callback);

    cleanup1();
    expect(destroyMock).not.toHaveBeenCalled();

    const handler = onMock.mock.calls[0][1];
    handler({ action: "input", story: { id: 6 } });
    expect(callback).toHaveBeenCalledOnce();

    cleanup2();
    await flushMicrotasks();
    expect(destroyMock).toHaveBeenCalledOnce();
  });

  it("continues fan-out when one subscriber throws", async () => {
    inEditor();

    const warning = vi.spyOn(console, "error").mockImplementation(() => {});
    const throwingCallback = vi.fn(() => {
      throw new Error("subscriber failed");
    });
    const followingCallback = vi.fn();
    const cleanup1 = await subscribe(throwingCallback);
    const cleanup2 = await subscribe(followingCallback);

    const handler = onMock.mock.calls[0][1];
    expect(() => handler({ action: "input", story: { id: 8 } })).not.toThrow();
    expect(followingCallback).toHaveBeenCalledWith(expect.objectContaining({ id: 8 }));
    expect(warning).toHaveBeenCalledWith(
      "[Storyblok] Live preview subscriber threw:",
      expect.any(Error),
    );
    cleanup1();
    cleanup2();
  });

  it("destroys the bridge only when the last subscriber cleans up", async () => {
    inEditor();

    const cleanup1 = await subscribe(vi.fn());
    const cleanup2 = await subscribe(vi.fn());

    cleanup1();
    expect(destroyMock).not.toHaveBeenCalled();

    cleanup2();
    expect(destroyMock).toHaveBeenCalledOnce();
  });

  it("destroys the bridge when the sole subscriber cleans up", async () => {
    inEditor();

    const cleanup = await subscribe(vi.fn());
    cleanup();

    expect(destroyMock).toHaveBeenCalledOnce();
  });

  it("reloads page on change event", async () => {
    inEditor();

    await subscribe(vi.fn());

    const handler = onMock.mock.calls[0][1];
    handler({ action: "change" });

    expect(window.location.reload).toHaveBeenCalledOnce();
  });

  it("reloads page on published event", async () => {
    inEditor();

    await subscribe(vi.fn());

    const handler = onMock.mock.calls[0][1];
    handler({ action: "published" });

    expect(window.location.reload).toHaveBeenCalledOnce();
  });

  it("overrides caller-supplied initOnlyOnce", async () => {
    inEditor();

    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});

    await subscribe(vi.fn(), { initOnlyOnce: true });

    expect(loadStoryblokBridge).toHaveBeenCalledWith({ initOnlyOnce: false });
    expect(warning).toHaveBeenCalledWith(
      '[Storyblok] Live preview option "initOnlyOnce" ignored; shared bridges always use false.',
    );
  });

  it("does not reload on change or published after all subscribers clean up", async () => {
    inEditor();

    const cleanup = await subscribe(vi.fn());
    cleanup();

    const handler = onMock.mock.calls[0][1];
    handler({ action: "change" });
    handler({ action: "published" });

    expect(window.location.reload).not.toHaveBeenCalled();
  });

  it("calling cleanup twice only removes the subscriber once", async () => {
    inEditor();

    const cleanup = await subscribe(vi.fn());
    cleanup();
    cleanup();

    expect(destroyMock).toHaveBeenCalledOnce();
  });

  it("retries after bridge loading fails", async () => {
    inEditor();

    vi.mocked(loadStoryblokBridge)
      .mockRejectedValueOnce(new Error("bridge failed"))
      .mockResolvedValueOnce({ on: onMock, destroy: destroyMock } as unknown as StoryblokBridge);

    await expect(subscribe(vi.fn())).rejects.toThrow("bridge failed");
    const cleanup = await subscribe(vi.fn());

    expect(loadStoryblokBridge).toHaveBeenCalledTimes(2);
    cleanup();
  });

  it("ignores null and undefined events without throwing", async () => {
    inEditor();

    await subscribe(vi.fn());
    const handler = onMock.mock.calls[0][1];

    expect(() => handler(null)).not.toThrow();
    expect(() => handler(undefined)).not.toThrow();
  });

  it("ignores events with an unrecognised action", async () => {
    inEditor();

    const cb = vi.fn();
    await subscribe(cb);

    const handler = onMock.mock.calls[0][1];
    handler({ action: "enterEditmode" });

    expect(cb).not.toHaveBeenCalled();
    expect(window.location.reload).not.toHaveBeenCalled();
  });

  it("does not call callback when input event has no story", async () => {
    inEditor();

    const cb = vi.fn();
    await subscribe(cb);

    const handler = onMock.mock.calls[0][1];
    handler({ action: "input" }); // story is absent

    expect(cb).not.toHaveBeenCalled();
  });

  it("drops a departed subscriber's options instead of ratcheting them forever", async () => {
    inEditor();

    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const cleanupA = await subscribe(vi.fn(), { resolveRelations: ["a.rel"], preventClicks: true });
    const cleanupB = await subscribe(vi.fn(), { resolveRelations: ["b.rel"] });
    cleanupA();
    await flushMicrotasks();
    warning.mockClear();

    await subscribe(vi.fn(), { resolveRelations: ["c.rel"] });

    // Only B's and C's contributions remain — A's relation and its
    // `preventClicks` are dropped from the live bridge, not merged in forever.
    expect(loadStoryblokBridge).toHaveBeenLastCalledWith({
      resolveRelations: ["b.rel", "c.rel"],
      initOnlyOnce: false,
    });
    cleanupB();
  });

  it("destroys an orphaned bridge when a rebuild rejects after every subscriber leaves", async () => {
    inEditor();

    let resolveFirstBridge!: (bridge: StoryblokBridge) => void;
    let rejectSecondBridge!: (error: Error) => void;
    const firstBridge = new Promise<StoryblokBridge>((resolve) => {
      resolveFirstBridge = resolve;
    });
    const secondBridge = new Promise<StoryblokBridge>((_resolve, reject) => {
      rejectSecondBridge = reject;
    });
    vi.mocked(loadStoryblokBridge).mockImplementationOnce(() => firstBridge);
    vi.mocked(loadStoryblokBridge).mockImplementationOnce(() => secondBridge);

    const pA = onStoryblokEditorEvent(vi.fn(), { resolveRelations: ["a.rel"] });
    // Let the reconcile loop's first pass (options from A alone) reach its
    // `await loadStoryblokBridge(...)` call before B contributes more options.
    await flushMicrotasks();
    const pB = onStoryblokEditorEvent(vi.fn(), { resolveRelations: ["b.rel"] });

    resolveFirstBridge({ on: onMock, destroy: destroyMock } as unknown as StoryblokBridge);
    await flushMicrotasks();
    rejectSecondBridge(new Error("second bridge failed"));

    await expect(pA).rejects.toThrow("second bridge failed");
    await expect(pB).rejects.toThrow("second bridge failed");

    // The bridge built from the first pass is not left dangling: both
    // subscribers failed and unsubscribed, so it must be torn down even
    // though it was never handed back to a caller.
    expect(destroyMock).toHaveBeenCalledOnce();
  });

  it("does not reject an already-settled subscriber when a later, unrelated rebuild fails", async () => {
    inEditor();

    const cleanupA = await subscribe(vi.fn(), { resolveRelations: ["a.rel"] });
    expect(loadStoryblokBridge).toHaveBeenCalledTimes(1);

    vi.mocked(loadStoryblokBridge).mockRejectedValueOnce(new Error("bad customParent"));
    await expect(subscribe(vi.fn(), { resolveRelations: ["b.rel"] })).rejects.toThrow(
      "bad customParent",
    );

    // A's own subscribe already resolved before B's failing subscribe was
    // made, so A is not retroactively rejected — though its bridge is still
    // destroyed, since two bridges can never be live at once.
    expect(destroyMock).toHaveBeenCalledOnce();
    cleanupA();
  });
});
