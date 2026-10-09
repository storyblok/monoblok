import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLivePreviewHandler } from "./create-live-preview-handler";
import type { Story } from "./generated/types/story";
import type StoryblokBridge from "@storyblok/preview-bridge";

const story = { id: 1, content: { _uid: "abc", component: "page" } };

describe("createLivePreviewHandler types", () => {
  it("handler.handle is assignable to StoryblokBridge#on's callback (type-only check)", () => {
    const handler = createLivePreviewHandler<Story>({
      currentRoot: () => document.body,
      update: async () => document.body,
    });
    const on = vi.fn() as unknown as StoryblokBridge["on"];
    // This line is the regression check: it must type-check.
    on(["input", "change", "published"], handler.handle);
    expect(on).toHaveBeenCalled();
  });
});

describe("createLivePreviewHandler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = "<p>Before</p>";
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function createNextRoot(html: string): HTMLElement {
    const body = document.implementation.createHTMLDocument().body;
    body.innerHTML = html;
    return body;
  }

  it("debounces input events and morphs the rendered root", async () => {
    const update = vi.fn(async () => createNextRoot("<p>After</p>"));
    const onUpdated = vi.fn();
    const handler = createLivePreviewHandler({
      currentRoot: () => document.body,
      update,
      onUpdated,
    });

    await handler.handle({ action: "input", story });
    expect(update).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(500);

    expect(update).toHaveBeenCalledWith({ story, signal: expect.any(AbortSignal) });
    expect(document.body.textContent).toBe("After");
    expect(onUpdated).toHaveBeenCalledWith(story);
  });

  it("cancels an update before it reaches the update callback", async () => {
    const update = vi.fn(async () => createNextRoot("<p>After</p>"));
    const onBeforeUpdate = vi.fn(() => false);
    const handler = createLivePreviewHandler({
      currentRoot: () => document.body,
      update,
      onBeforeUpdate,
    });

    await handler.handle({ action: "input", story });
    await vi.advanceTimersByTimeAsync(500);

    expect(onBeforeUpdate).toHaveBeenCalledWith(story);
    expect(update).not.toHaveBeenCalled();
    expect(document.body.textContent).toBe("Before");
  });

  it("calls the reload callback for published and changed stories", async () => {
    const onReload = vi.fn();
    const handler = createLivePreviewHandler({
      currentRoot: () => document.body,
      update: vi.fn(),
      onReload,
    });

    await handler.handle({ action: "change" });
    await handler.handle({ action: "published" });

    expect(onReload).toHaveBeenNthCalledWith(1, "change");
    expect(onReload).toHaveBeenNthCalledWith(2, "published");
  });

  it("reloads the page by default for published and changed stories", async () => {
    const reload = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload });
    const handler = createLivePreviewHandler({
      currentRoot: () => document.body,
      update: vi.fn(),
    });

    await handler.handle({ action: "change" });

    expect(reload).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });

  it("cancels a pending debounced input before reloading", async () => {
    const update = vi.fn(async () => createNextRoot("<p>After</p>"));
    const onReload = vi.fn();
    const handler = createLivePreviewHandler({
      currentRoot: () => document.body,
      update,
      onReload,
    });

    await handler.handle({ action: "input", story });
    await handler.handle({ action: "change" });
    await vi.advanceTimersByTimeAsync(500);

    expect(update).not.toHaveBeenCalled();
    expect(onReload).toHaveBeenCalledWith("change");
  });

  it("reports onReload failures instead of rejecting handle()", async () => {
    const error = new Error("reload failed");
    const onError = vi.fn();
    const handler = createLivePreviewHandler({
      currentRoot: () => document.body,
      update: vi.fn(),
      onReload: () => {
        throw error;
      },
      onError,
    });

    await expect(handler.handle({ action: "change" })).resolves.toBeUndefined();
  });

  it("stops pending work when disposed", async () => {
    const update = vi.fn(async () => createNextRoot("<p>After</p>"));
    const handler = createLivePreviewHandler({
      currentRoot: () => document.body,
      update,
    });

    await handler.handle({ action: "input", story });
    handler.dispose();
    await vi.advanceTimersByTimeAsync(500);

    expect(update).not.toHaveBeenCalled();
    await handler.handle({ action: "input", story });
    expect(update).not.toHaveBeenCalled();
  });

  it("reports non-abort update failures", async () => {
    const error = new Error("render failed");
    const onError = vi.fn();
    const handler = createLivePreviewHandler({
      currentRoot: () => document.body,
      update: vi.fn(async () => {
        throw error;
      }),
      onError,
    });

    await handler.handle({ action: "input", story });
    await vi.advanceTimersByTimeAsync(500);

    expect(onError).toHaveBeenCalledWith(error, story);
  });

  it("logs non-abort update failures by default when no onError is given", async () => {
    const error = new Error("render failed");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = createLivePreviewHandler({
      currentRoot: () => document.body,
      update: vi.fn(async () => {
        throw error;
      }),
    });

    await handler.handle({ action: "input", story });
    await vi.advanceTimersByTimeAsync(500);

    expect(consoleError).toHaveBeenCalledWith(expect.any(String), error);
  });

  it("does not report a superseded request that rejects with a non-AbortError", async () => {
    const onError = vi.fn();
    let callCount = 0;
    const update = vi.fn(async ({ signal }: { signal: AbortSignal }) => {
      callCount += 1;
      if (callCount === 1) {
        // Simulate a fetch helper that rejects with a plain TypeError instead
        // of throwing an AbortError once its signal is aborted.
        return new Promise<HTMLElement>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(new TypeError("Failed to fetch")));
        });
      }
      return createNextRoot("<p>After</p>");
    });
    const handler = createLivePreviewHandler({
      currentRoot: () => document.body,
      update,
      onError,
    });

    await handler.handle({ action: "input", story });
    await vi.advanceTimersByTimeAsync(500);
    await handler.handle({
      action: "input",
      story: { id: 2, content: { _uid: "def", component: "page" } },
    });
    await vi.advanceTimersByTimeAsync(500);

    expect(onError).not.toHaveBeenCalled();
  });
});
