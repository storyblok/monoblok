import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BridgeParams } from "@storyblok/preview-bridge";

// ---- mocks ----

vi.mock("./utils/isBrowser", () => ({ isBrowser: vi.fn() }));
vi.mock("./utils/isInEditor", () => ({ isInEditor: vi.fn() }));

const onMock = vi.fn();

vi.mock("./loadStoryblokBridge", () => ({
  loadStoryblokBridge: vi.fn(async () => ({ on: onMock })),
}));

import { isBrowser } from "./utils/isBrowser";
import { isInEditor } from "./utils/isInEditor";
import { loadStoryblokBridge } from "./loadStoryblokBridge";
import { onStoryblokEditorEvent } from "./onStoryblokEditorEvent";

describe("onStoryblokEditorEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    Object.defineProperty(window, "location", {
      value: { reload: vi.fn(), href: "http://localhost/" },
      writable: true,
    });
  });

  function inEditor() {
    vi.mocked(isBrowser).mockReturnValue(true);
    vi.mocked(isInEditor).mockReturnValue(true);
  }

  it("returns a no-op cleanup when not in browser", async () => {
    vi.mocked(isBrowser).mockReturnValue(false);

    const cleanup = await onStoryblokEditorEvent(vi.fn());

    expect(loadStoryblokBridge).not.toHaveBeenCalled();
    expect(cleanup).toBeTypeOf("function");
  });

  it("returns a no-op cleanup when not in editor", async () => {
    vi.mocked(isBrowser).mockReturnValue(true);
    vi.mocked(isInEditor).mockReturnValue(false);

    const cleanup = await onStoryblokEditorEvent(vi.fn());

    expect(loadStoryblokBridge).not.toHaveBeenCalled();
    expect(cleanup).toBeTypeOf("function");
  });

  it("passes bridgeOptions to loadStoryblokBridge", async () => {
    inEditor();

    const config: BridgeParams = { resolveRelations: ["foo.bar"] };
    await onStoryblokEditorEvent(vi.fn(), config);

    expect(loadStoryblokBridge).toHaveBeenCalledWith(config);
  });

  it("creates a separate bridge per call", async () => {
    inEditor();

    await onStoryblokEditorEvent(vi.fn(), { resolveRelations: ["a.b"] });
    await onStoryblokEditorEvent(vi.fn(), { resolveRelations: ["c.d"] });

    expect(loadStoryblokBridge).toHaveBeenCalledTimes(2);
  });

  it("each call respects its own config independently", async () => {
    inEditor();

    await onStoryblokEditorEvent(vi.fn(), { resolveRelations: ["a.b"] });
    await onStoryblokEditorEvent(vi.fn(), { resolveRelations: ["c.d"] });

    expect(loadStoryblokBridge).toHaveBeenNthCalledWith(1, { resolveRelations: ["a.b"] });
    expect(loadStoryblokBridge).toHaveBeenNthCalledWith(2, { resolveRelations: ["c.d"] });
  });

  it("calls callback on input event", async () => {
    inEditor();

    const cb = vi.fn();
    await onStoryblokEditorEvent(cb);

    const handler = onMock.mock.calls[0][1];
    handler({ action: "input", story: { id: 42 } });

    expect(cb).toHaveBeenCalledWith(expect.objectContaining({ id: 42 }));
  });

  it("does not call callback after cleanup", async () => {
    inEditor();

    const cb = vi.fn();
    const cleanup = await onStoryblokEditorEvent(cb);
    cleanup();

    const handler = onMock.mock.calls[0][1];
    handler({ action: "input", story: { id: 1 } });

    expect(cb).not.toHaveBeenCalled();
  });

  it("reloads page on change event", async () => {
    inEditor();

    await onStoryblokEditorEvent(vi.fn());

    const handler = onMock.mock.calls[0][1];
    handler({ action: "change" });

    expect(window.location.reload).toHaveBeenCalledOnce();
  });

  it("reloads page on published event", async () => {
    inEditor();

    await onStoryblokEditorEvent(vi.fn());

    const handler = onMock.mock.calls[0][1];
    handler({ action: "published" });

    expect(window.location.reload).toHaveBeenCalledOnce();
  });
});
