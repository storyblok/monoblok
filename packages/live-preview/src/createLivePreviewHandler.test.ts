import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLivePreviewHandler } from "./createLivePreviewHandler";

const story = { id: 1, content: { component: "page" } };

describe("createLivePreviewHandler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = "<p>Before</p>";
  });

  afterEach(() => {
    vi.useRealTimers();
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
});
