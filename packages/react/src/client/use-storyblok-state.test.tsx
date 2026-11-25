import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { onStoryblokEditorEvent } from "@storyblok/live-preview";
import type { Story } from "../types";
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
  let editorCallbacks: EditorCallback[] = [];
  const mockUnsubscribe = vi.fn();

  beforeEach(() => {
    editorCallback = undefined;
    editorCallbacks = [];
    vi.clearAllMocks();
    vi.mocked(onStoryblokEditorEvent).mockImplementation((cb) => {
      editorCallback = cb as EditorCallback;
      editorCallbacks.push(cb as EditorCallback);
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

  it("preserves content when an editor event omits it", async () => {
    const initial = makeStory({ content: { component: "page", _uid: "page-1" } });
    const { result } = renderHook(() => useStoryblokState(initial));

    await vi.waitFor(() => expect(editorCallback).toBeDefined());

    act(() => {
      editorCallback!({ id: "1", slug: "updated" });
    });

    expect(result.current).toMatchObject({
      id: "1",
      slug: "updated",
      content: { component: "page", _uid: "page-1" },
    });
  });

  it("reflects multiple sequential editor updates", async () => {
    const initial = makeStory({ slug: "v1" });
    const { result } = renderHook(() => useStoryblokState(initial));

    await vi.waitFor(() => expect(editorCallback).toBeDefined());

    act(() => editorCallback!(makeStory({ slug: "v2" })));
    expect(result.current.slug).toBe("v2");

    act(() => editorCallback!(makeStory({ slug: "v3" })));
    expect(result.current.slug).toBe("v3");
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

    expect(result.current.slug).toBe("before");
  });

  it("resets to the new story when story.id changes (cross-route navigation)", async () => {
    const storyA = makeStory({ id: 1, slug: "page-a" });
    const storyB = makeStory({ id: 2, slug: "page-b" });

    const { result, rerender } = renderHook(({ story }) => useStoryblokState(story), {
      initialProps: { story: storyA },
    });

    expect(result.current.slug).toBe("page-a");

    // Simulate cross-route navigation: same component instance, new story
    await act(async () => {
      rerender({ story: storyB });
    });

    expect(result.current.slug).toBe("page-b");
  });

  it("resets when the same story.id is refreshed with a new reference", async () => {
    const story = makeStory({ id: 1, slug: "home" });
    const storyNewRef = makeStory({ id: 1, slug: "home-ref2" });

    const { result, rerender } = renderHook(({ s }) => useStoryblokState(s), {
      initialProps: { s: story },
    });

    await vi.waitFor(() => expect(editorCallback).toBeDefined());

    // Editor update to change displayed content first
    act(() => editorCallback!(makeStory({ id: 1, slug: "editor-updated" })));
    expect(result.current.slug).toBe("editor-updated");

    // A new prop reference represents refreshed route data and replaces editor state.
    await act(async () => {
      rerender({ s: storyNewRef });
    });

    expect(result.current.slug).toBe("home-ref2");
  });

  it("does not reset a live edit when a parent re-renders with a content-identical story object", async () => {
    const story = makeStory({ id: 1, slug: "home", content: { component: "page", _uid: "p1" } });
    const storyDuplicate = makeStory({
      id: 1,
      slug: "home",
      content: { component: "page", _uid: "p1" },
    });

    const { result, rerender } = renderHook(({ s }) => useStoryblokState(s), {
      initialProps: { s: story },
    });

    await vi.waitFor(() => expect(editorCallback).toBeDefined());

    act(() => editorCallback!(makeStory({ id: 1, slug: "editor-updated" })));
    expect(result.current.slug).toBe("editor-updated");

    // A parent re-render passing a fresh-but-identical object (e.g. `{...story}`)
    // must not wipe the live edit.
    await act(async () => {
      rerender({ s: storyDuplicate });
    });

    expect(result.current.slug).toBe("editor-updated");
  });

  it("does not reset a live edit when a parent re-renders with the same story in a different key order", async () => {
    const story = makeStory({ id: 1, slug: "home", content: { component: "page", _uid: "p1" } });
    const storyReordered = {
      content: { _uid: "p1", component: "page" },
      slug: "home",
      id: 1,
    } as unknown as Story;

    const { result, rerender } = renderHook(({ s }) => useStoryblokState(s), {
      initialProps: { s: story },
    });

    await vi.waitFor(() => expect(editorCallback).toBeDefined());

    act(() => editorCallback!(makeStory({ id: 1, slug: "editor-updated" })));
    expect(result.current.slug).toBe("editor-updated");

    await act(async () => {
      rerender({ s: storyReordered });
    });

    expect(result.current.slug).toBe("editor-updated");
  });

  it("resets a live edit when the same story id arrives with changed nested content", async () => {
    const story = makeStory({ id: 1, slug: "home", content: { component: "page", _uid: "p1" } });
    const storyRefreshed = makeStory({
      id: 1,
      slug: "home",
      content: { component: "page", _uid: "p1", body: [{ component: "teaser", _uid: "t1" }] },
    });

    const { result, rerender } = renderHook(({ s }) => useStoryblokState(s), {
      initialProps: { s: story },
    });

    await vi.waitFor(() => expect(editorCallback).toBeDefined());

    act(() => editorCallback!(makeStory({ id: 1, slug: "editor-updated" })));
    expect(result.current.slug).toBe("editor-updated");

    await act(async () => {
      rerender({ s: storyRefreshed });
    });

    expect(result.current.slug).toBe("home");
  });

  it("filters editor events by the current story id after a client-side navigation", async () => {
    const storyA = makeStory({ id: 1, slug: "a" });
    const storyB = makeStory({ id: 2, slug: "b" });

    // A client-side navigation re-renders the same mounted hook with a new
    // story, so the editor subscription made for story A stays in place.
    const { result, rerender } = renderHook(({ s }) => useStoryblokState(s), {
      initialProps: { s: storyA },
    });
    await vi.waitFor(() => expect(editorCallback).toBeDefined());

    await act(async () => {
      rerender({ s: storyB });
    });
    expect(result.current.slug).toBe("b");
    expect(editorCallbacks).toHaveLength(1);

    // The editor still sends story A: it must not replace page B.
    act(() => editorCallback!(makeStory({ id: 1, slug: "a-edited" })));
    expect(result.current.slug).toBe("b");

    act(() => editorCallback!(makeStory({ id: 2, slug: "b-edited" })));
    expect(result.current.slug).toBe("b-edited");
  });

  it("keeps a pending debounced update when an event for another story arrives", async () => {
    vi.useFakeTimers();
    try {
      const story = makeStory({ id: 1, slug: "page" });
      const { result } = renderHook(() => useStoryblokState(story, { debounceMs: 100 }));
      await vi.waitFor(() => expect(editorCallback).toBeDefined());

      // A page edit is pending when an event for another story (e.g. a nav
      // story) arrives inside the debounce window.
      act(() => {
        editorCallback!(makeStory({ id: 1, slug: "page-edited" }));
        editorCallback!(makeStory({ id: 2, slug: "nav-edited" }));
        vi.advanceTimersByTime(100);
      });

      expect(result.current.slug).toBe("page-edited");
    } finally {
      vi.useRealTimers();
    }
  });

  it("ignores editor events for a different story id", async () => {
    const pageStory = makeStory({ id: 1, slug: "page" });
    const navStory = makeStory({ id: 2, slug: "nav" });

    const pageHook = renderHook(() => useStoryblokState(pageStory));
    const navHook = renderHook(() => useStoryblokState(navStory));

    await vi.waitFor(() => expect(editorCallbacks).toHaveLength(2));

    act(() => {
      for (const cb of editorCallbacks) {
        cb(makeStory({ id: 1, slug: "page-edited" }));
      }
    });

    expect(pageHook.result.current.slug).toBe("page-edited");
    expect(navHook.result.current.slug).toBe("nav");
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
      expect(result.current.slug).toBe("initial");

      await act(async () => {
        vi.advanceTimersByTime(100);
        await vi.runAllTimersAsync();
      });

      expect(result.current.slug).toBe("updated");
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

      expect(result.current.slug).toBe("v3");
    });
  });
});
