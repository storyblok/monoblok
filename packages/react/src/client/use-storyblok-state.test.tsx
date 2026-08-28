import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { Story } from "@storyblok/api-client";
import { onStoryblokEditorEvent } from "@storyblok/live-preview";
import { useStoryblokState } from "./use-storyblok-state";

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

describe("useStoryblokState", () => {
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

  it("returns the initial story on first render", () => {
    const story = makeStory({ slug: "home" });
    const { result } = renderHook(() => useStoryblokState(story));
    expect(result.current).toBe(story);
  });

  it("subscribes to editor events on mount", async () => {
    const story = makeStory();
    renderHook(() => useStoryblokState(story));
    await vi.waitFor(() => expect(onStoryblokEditorEvent).toHaveBeenCalledOnce());
  });

  it("returns the updated story when the editor fires an event", async () => {
    const initial = makeStory({ slug: "initial" });
    const updated = makeStory({ slug: "updated" });

    const { result } = renderHook(() => useStoryblokState(initial));

    await vi.waitFor(() => expect(editorCallback).toBeDefined());

    act(() => {
      editorCallback!(updated);
    });

    expect(result.current).toStrictEqual(updated);
  });

  it("reflects multiple sequential editor updates", async () => {
    const initial = makeStory({ slug: "v1" });
    const { result } = renderHook(() => useStoryblokState(initial));

    await vi.waitFor(() => expect(editorCallback).toBeDefined());

    act(() => editorCallback!(makeStory({ slug: "v2" })));
    expect((result.current as any).slug).toBe("v2");

    act(() => editorCallback!(makeStory({ slug: "v3" })));
    expect((result.current as any).slug).toBe("v3");
  });

  it("calls the unsubscribe function when the component unmounts", async () => {
    const story = makeStory();
    const { unmount } = renderHook(() => useStoryblokState(story));

    await vi.waitFor(() => expect(mockUnsubscribe).not.toHaveBeenCalled());

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalledOnce();
  });

  it("ignores editor updates that arrive after unmount", async () => {
    const initial = makeStory({ slug: "before" });
    const { result, unmount } = renderHook(() => useStoryblokState(initial));

    await vi.waitFor(() => expect(editorCallback).toBeDefined());

    unmount();

    act(() => editorCallback!(makeStory({ slug: "after" })));

    expect((result.current as any).slug).toBe("before");
  });

  it("resets to the new story when story.id changes (cross-route navigation)", async () => {
    const storyA = makeStory({ id: 1, slug: "page-a" });
    const storyB = makeStory({ id: 2, slug: "page-b" });

    const { result, rerender } = renderHook(({ story }) => useStoryblokState(story), {
      initialProps: { story: storyA },
    });

    expect((result.current as any).slug).toBe("page-a");

    // Simulate cross-route navigation: same component instance, new story
    await act(async () => {
      rerender({ story: storyB });
    });

    expect((result.current as any).slug).toBe("page-b");
  });

  it("does not reset when the same story.id is re-rendered with a new reference", async () => {
    const story = makeStory({ id: 1, slug: "home" });
    const storyNewRef = makeStory({ id: 1, slug: "home-ref2" });

    const { result, rerender } = renderHook(({ s }) => useStoryblokState(s), {
      initialProps: { s: story },
    });

    await vi.waitFor(() => expect(editorCallback).toBeDefined());

    // Editor update to change displayed content first
    act(() => editorCallback!(makeStory({ id: 1, slug: "editor-updated" })));
    expect((result.current as any).slug).toBe("editor-updated");

    // Re-render with same id but different reference — must NOT reset editor state
    await act(async () => {
      rerender({ s: storyNewRef });
    });

    expect((result.current as any).slug).toBe("editor-updated");
  });

  describe("with debounceMs option", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("delays state update until debounce settles", async () => {
      const initial = makeStory({ slug: "initial" });
      const updated = makeStory({ slug: "updated" });

      const { result } = renderHook(() => useStoryblokState(initial, { debounceMs: 100 }));
      await vi.waitFor(() => expect(editorCallback).toBeDefined());

      act(() => editorCallback!(updated));
      expect((result.current as any).slug).toBe("initial");

      await act(async () => {
        vi.advanceTimersByTime(100);
        await vi.runAllTimersAsync();
      });

      expect((result.current as any).slug).toBe("updated");
    });

    it("only applies the last of multiple rapid events", async () => {
      const initial = makeStory({ slug: "initial" });
      const { result } = renderHook(() => useStoryblokState(initial, { debounceMs: 100 }));
      await vi.waitFor(() => expect(editorCallback).toBeDefined());

      act(() => editorCallback!(makeStory({ slug: "v2" })));
      await act(async () => vi.advanceTimersByTime(50));

      act(() => editorCallback!(makeStory({ slug: "v3" })));
      await act(async () => {
        vi.advanceTimersByTime(100);
        await vi.runAllTimersAsync();
      });

      expect((result.current as any).slug).toBe("v3");
    });
  });
});
