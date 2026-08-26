import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { Story } from "@storyblok/api-client";
import { onStoryblokEditorEvent } from "@storyblok/live-preview";
import { useStoryblokEditorEvent } from "../../client/use-storyblok-editor-event";

// ─── Mock @storyblok/live-preview ─────────────────────────────────────────────

vi.mock("@storyblok/live-preview", () => ({
  onStoryblokEditorEvent: vi.fn(),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

type EditorCallback = (story: unknown) => void;

function makeStory(overrides: Record<string, unknown> = {}): Story {
  return { id: "1", slug: "home", content: {}, ...overrides } as unknown as Story;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("useStoryblokEditorEvent", () => {
  let editorCallback: EditorCallback | undefined;
  const mockUnsubscribe = vi.fn();

  beforeEach(() => {
    editorCallback = undefined;
    vi.clearAllMocks();
    vi.mocked(onStoryblokEditorEvent).mockImplementation(async (cb) => {
      editorCallback = cb as EditorCallback;
      return mockUnsubscribe;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("subscribes to editor events on mount", async () => {
    const callback = vi.fn();
    renderHook(() => useStoryblokEditorEvent(callback));
    await vi.waitFor(() => expect(onStoryblokEditorEvent).toHaveBeenCalledOnce());
  });

  it("invokes callback immediately when no debounce is set", async () => {
    const callback = vi.fn();
    const story = makeStory({ slug: "updated" });

    renderHook(() => useStoryblokEditorEvent(callback));
    await vi.waitFor(() => expect(editorCallback).toBeDefined());

    act(() => editorCallback!(story));

    expect(callback).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith(story);
  });

  it("unsubscribes on unmount", async () => {
    const { unmount } = renderHook(() => useStoryblokEditorEvent(vi.fn()));
    await vi.waitFor(() => expect(mockUnsubscribe).not.toHaveBeenCalled());
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledOnce();
  });

  it("ignores events that arrive after unmount", async () => {
    const callback = vi.fn();
    const { unmount } = renderHook(() => useStoryblokEditorEvent(callback));
    await vi.waitFor(() => expect(editorCallback).toBeDefined());
    unmount();
    act(() => editorCallback!(makeStory()));
    expect(callback).not.toHaveBeenCalled();
  });

  describe("with debounceMs", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("delays invocation until debounce settles", async () => {
      const callback = vi.fn();
      const story = makeStory({ slug: "updated" });

      renderHook(() => useStoryblokEditorEvent(callback, { debounceMs: 100 }));
      await vi.waitFor(() => expect(editorCallback).toBeDefined());

      act(() => editorCallback!(story));
      expect(callback).not.toHaveBeenCalled();

      await act(async () => {
        vi.advanceTimersByTime(100);
        await vi.runAllTimersAsync();
      });

      expect(callback).toHaveBeenCalledOnce();
      expect(callback).toHaveBeenCalledWith(story);
    });

    it("only calls callback once for rapid events within the debounce window", async () => {
      const callback = vi.fn();
      const first = makeStory({ slug: "first" });
      const last = makeStory({ slug: "last" });

      renderHook(() => useStoryblokEditorEvent(callback, { debounceMs: 100 }));
      await vi.waitFor(() => expect(editorCallback).toBeDefined());

      act(() => editorCallback!(first));
      await act(async () => vi.advanceTimersByTime(50));

      act(() => editorCallback!(last));
      await act(async () => {
        vi.advanceTimersByTime(100);
        await vi.runAllTimersAsync();
      });

      expect(callback).toHaveBeenCalledOnce();
      expect(callback).toHaveBeenCalledWith(last);
    });

    it("does not invoke callback when unmounted during debounce window", async () => {
      const callback = vi.fn();
      const { unmount } = renderHook(() => useStoryblokEditorEvent(callback, { debounceMs: 200 }));
      await vi.waitFor(() => expect(editorCallback).toBeDefined());

      act(() => editorCallback!(makeStory()));
      unmount();

      await act(async () => {
        vi.advanceTimersByTime(200);
        await vi.runAllTimersAsync();
      });

      expect(callback).not.toHaveBeenCalled();
    });

    it("always uses the latest callback ref without re-subscribing", async () => {
      const first = vi.fn();
      const second = vi.fn();
      let cb = first;

      const { rerender } = renderHook(() => useStoryblokEditorEvent(cb, { debounceMs: 50 }));
      await vi.waitFor(() => expect(editorCallback).toBeDefined());

      // swap callback between event and settlement
      cb = second;
      rerender();

      await act(async () => {
        editorCallback!(makeStory());
        vi.advanceTimersByTime(50);
        await vi.runAllTimersAsync();
      });

      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalledOnce();
      // subscribed only once — no re-registration
      expect(onStoryblokEditorEvent).toHaveBeenCalledOnce();
    });
  });
});
