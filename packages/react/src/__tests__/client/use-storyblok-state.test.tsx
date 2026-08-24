import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { Story } from "@storyblok/api-client";
import { onStoryblokEditorEvent } from "@storyblok/live-preview";
import { useStoryblokState } from "../../client/use-storyblok-state";

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

    // Wait for subscription to be registered
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

    // This call should be a no-op — the mounted flag is false
    act(() => editorCallback!(makeStory({ slug: "after" })));

    // State should still reflect the value at unmount time
    expect((result.current as any).slug).toBe("before");
  });
});
