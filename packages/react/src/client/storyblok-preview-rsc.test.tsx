import { type ReactNode } from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, act } from "@testing-library/react";
import type { Story } from "@storyblok/api-client";
import { onStoryblokEditorEvent } from "@storyblok/live-preview";
import { StoryblokPreviewRsc } from "./storyblok-preview-rsc";

// ─── Mock @storyblok/live-preview ─────────────────────────────────────────────

vi.mock("@storyblok/live-preview", () => ({
  onStoryblokEditorEvent: vi.fn(),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

type EditorCallback = (story: unknown) => void;

function makeStory(overrides: Record<string, unknown> = {}): Story {
  return { id: "1", slug: "home", content: {}, ...overrides } as unknown as Story;
}

/**
 * Fires the editor callback then flushes all pending fake timers and
 * microtasks through a single act() so React commits the resulting state.
 */
async function fireEditorEvent(
  callback: EditorCallback,
  story: Story,
  debounceMs = 0,
): Promise<void> {
  await act(async () => {
    callback(story);
    vi.advanceTimersByTime(debounceMs);
    await vi.runAllTimersAsync();
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("StoryblokPreviewRsc", () => {
  let editorCallback: EditorCallback | undefined;
  const mockUnsubscribe = vi.fn();

  beforeEach(() => {
    editorCallback = undefined;
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.mocked(onStoryblokEditorEvent).mockImplementation(async (cb) => {
      editorCallback = cb as EditorCallback;
      return mockUnsubscribe;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renders children immediately on first render (before any editor event)", () => {
    const renderContent = vi.fn();
    const { getByTestId } = render(
      <StoryblokPreviewRsc renderContent={renderContent}>
        <div data-testid="initial">initial content</div>
      </StoryblokPreviewRsc>,
    );

    expect(getByTestId("initial")).toBeInTheDocument();
    expect(renderContent).not.toHaveBeenCalled();
  });

  it("calls renderContent with the updated story after an editor event and debounce", async () => {
    const updatedStory = makeStory({ slug: "updated" });
    const renderContent = vi.fn().mockResolvedValue(<div>live</div>);

    render(
      <StoryblokPreviewRsc renderContent={renderContent} debounceMs={50}>
        <div>initial</div>
      </StoryblokPreviewRsc>,
    );

    await vi.waitFor(() => expect(editorCallback).toBeDefined());

    act(() => editorCallback!(updatedStory));
    expect(renderContent).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(50);
      await vi.runAllTimersAsync();
    });

    expect(renderContent).toHaveBeenCalledWith(updatedStory);
  });

  it("debounces rapid editor events — only calls renderContent once for the last event", async () => {
    const renderContent = vi.fn().mockResolvedValue(<div>content</div>);
    const firstStory = makeStory({ slug: "first" });
    const secondStory = makeStory({ slug: "second" });

    render(
      <StoryblokPreviewRsc renderContent={renderContent} debounceMs={100}>
        <div>initial</div>
      </StoryblokPreviewRsc>,
    );

    await vi.waitFor(() => expect(editorCallback).toBeDefined());

    act(() => editorCallback!(firstStory));
    await act(async () => vi.advanceTimersByTime(50));

    act(() => editorCallback!(secondStory));
    await act(async () => {
      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync();
    });

    expect(renderContent).toHaveBeenCalledOnce();
    expect(renderContent).toHaveBeenCalledWith(secondStory);
  });

  it("shows the new content after renderContent resolves", async () => {
    const updatedStory = makeStory({ slug: "updated" });
    const renderContent = vi.fn().mockResolvedValue(<div data-testid="live">live content</div>);

    const { getByTestId } = render(
      <StoryblokPreviewRsc renderContent={renderContent} debounceMs={0}>
        <div data-testid="initial">initial</div>
      </StoryblokPreviewRsc>,
    );

    await vi.waitFor(() => expect(editorCallback).toBeDefined());
    await fireEditorEvent(editorCallback!, updatedStory);

    expect(getByTestId("live")).toBeInTheDocument();
    expect(getByTestId("live")).toHaveTextContent("live content");
  });

  it("shows Suspense fallback (children) while renderContent is pending", async () => {
    const updatedStory = makeStory({ slug: "updated" });
    let resolveContent!: (node: ReactNode) => void;
    const renderContent = vi.fn(
      () =>
        new Promise<ReactNode>((resolve) => {
          resolveContent = resolve;
        }),
    );

    const { getByTestId, queryByTestId } = render(
      <StoryblokPreviewRsc renderContent={renderContent} debounceMs={0}>
        <div data-testid="initial">initial</div>
      </StoryblokPreviewRsc>,
    );

    await vi.waitFor(() => expect(editorCallback).toBeDefined());

    await act(async () => {
      editorCallback!(updatedStory);
      vi.advanceTimersByTime(0);
      await vi.runAllTimersAsync();
    });

    expect(getByTestId("initial")).toBeInTheDocument();
    expect(queryByTestId("live")).toBeNull();

    await act(async () => {
      resolveContent(<div data-testid="live">resolved</div>);
      await vi.runAllTimersAsync();
    });

    expect(getByTestId("live")).toBeInTheDocument();
  });

  it("shows the current content while a subsequent update is in flight (no duplicate DOM)", async () => {
    const firstStory = makeStory({ slug: "first" });
    const secondStory = makeStory({ slug: "second" });
    let resolveSecond!: (node: ReactNode) => void;

    const renderContent = vi
      .fn()
      .mockResolvedValueOnce(<div data-testid="first-live">first live</div>)
      .mockImplementationOnce(
        () =>
          new Promise<ReactNode>((resolve) => {
            resolveSecond = resolve;
          }),
      );

    const { getByTestId, getAllByTestId, queryByTestId } = render(
      <StoryblokPreviewRsc renderContent={renderContent} debounceMs={0}>
        <div data-testid="initial">initial</div>
      </StoryblokPreviewRsc>,
    );

    await vi.waitFor(() => expect(editorCallback).toBeDefined());

    await fireEditorEvent(editorCallback!, firstStory);
    expect(getByTestId("first-live")).toBeInTheDocument();

    await act(async () => {
      editorCallback!(secondStory);
      vi.advanceTimersByTime(0);
      await vi.runAllTimersAsync();
    });

    // The first-live content remains visible while the second edit is in flight
    expect(getByTestId("first-live")).toBeInTheDocument();
    // Exactly one copy — no duplicate DOM from a stale Suspense fallback (#10)
    expect(getAllByTestId("first-live")).toHaveLength(1);
    expect(queryByTestId("second-live")).toBeNull();

    await act(async () => {
      resolveSecond(<div data-testid="second-live">second live</div>);
      await vi.runAllTimersAsync();
    });

    expect(getByTestId("second-live")).toBeInTheDocument();
  });

  it("shows children fallback when renderContent rejects, then recovers on the next event", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const firstStory = makeStory({ slug: "first" });
    const secondStory = makeStory({ slug: "second" });

    const renderContent = vi
      .fn()
      .mockRejectedValueOnce(new Error("server error"))
      .mockResolvedValueOnce(<div data-testid="recovered">recovered content</div>);

    const { getByTestId, queryByTestId } = render(
      <StoryblokPreviewRsc renderContent={renderContent} debounceMs={0}>
        <div data-testid="initial">initial</div>
      </StoryblokPreviewRsc>,
    );

    await vi.waitFor(() => expect(editorCallback).toBeDefined());

    // First event — renderContent rejects
    await fireEditorEvent(editorCallback!, firstStory);

    // Error boundary must keep children visible, not crash the page
    expect(getByTestId("initial")).toBeInTheDocument();
    expect(queryByTestId("recovered")).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[Storyblok]"),
      expect.any(Error),
    );

    // Second event — renderContent resolves → boundary resets and shows new content
    await fireEditorEvent(editorCallback!, secondStory);
    expect(getByTestId("recovered")).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  // ─── Concurrent action gating ──────────────────────────────────────────────
  //
  // Each test below fires an event while a server action is still in-flight.
  // The desired behaviour is: at most one action running at a time; the latest
  // story that arrived mid-flight is queued and dispatched once the current
  // action settles (resolve or reject); intermediate stories are discarded.

  it("does not start a second renderContent call while the first is in-flight", async () => {
    let resolveFirst!: (node: ReactNode) => void;
    const firstStory = makeStory({ slug: "first" });
    const secondStory = makeStory({ slug: "second" });

    const renderContent = vi.fn().mockImplementationOnce(
      () =>
        new Promise<ReactNode>((resolve) => {
          resolveFirst = resolve;
        }),
    );

    render(
      <StoryblokPreviewRsc renderContent={renderContent} debounceMs={0}>
        <div>initial</div>
      </StoryblokPreviewRsc>,
    );

    await vi.waitFor(() => expect(editorCallback).toBeDefined());

    // First event — action is now in-flight (unresolved promise)
    await act(async () => {
      editorCallback!(firstStory);
      vi.advanceTimersByTime(0);
      await vi.runAllTimersAsync();
    });

    expect(renderContent).toHaveBeenCalledOnce();

    // Second event fires while first is still pending
    await act(async () => {
      editorCallback!(secondStory);
      vi.advanceTimersByTime(0);
      await vi.runAllTimersAsync();
    });

    // Must still be one — the second action must not have started yet
    expect(renderContent).toHaveBeenCalledOnce();

    // Clean up — resolve so the component doesn't leak a pending promise
    await act(async () => {
      resolveFirst(<div>first</div>);
      await vi.runAllTimersAsync();
    });
  });

  it("runs the queued story after the in-flight action resolves", async () => {
    let resolveFirst!: (node: ReactNode) => void;
    const firstStory = makeStory({ slug: "first" });
    const secondStory = makeStory({ slug: "second" });

    const renderContent = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<ReactNode>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce(<div data-testid="second-live">second</div>);

    const { getByTestId } = render(
      <StoryblokPreviewRsc renderContent={renderContent} debounceMs={0}>
        <div>initial</div>
      </StoryblokPreviewRsc>,
    );

    await vi.waitFor(() => expect(editorCallback).toBeDefined());

    // Start first (in-flight), then queue second
    await act(async () => {
      editorCallback!(firstStory);
      vi.advanceTimersByTime(0);
      await vi.runAllTimersAsync();
    });
    await act(async () => {
      editorCallback!(secondStory);
      vi.advanceTimersByTime(0);
      await vi.runAllTimersAsync();
    });

    expect(renderContent).toHaveBeenCalledOnce();

    // Resolving the first should trigger the queued second
    await act(async () => {
      resolveFirst(<div data-testid="first-live">first</div>);
      await vi.runAllTimersAsync();
    });

    expect(renderContent).toHaveBeenCalledTimes(2);
    expect(renderContent).toHaveBeenNthCalledWith(2, secondStory);
    expect(getByTestId("second-live")).toBeInTheDocument();
  });

  it("discards intermediate stories and runs only the latest queued story", async () => {
    let resolveFirst!: (node: ReactNode) => void;
    const firstStory = makeStory({ slug: "first" });
    const middleStory = makeStory({ slug: "middle" });
    const lastStory = makeStory({ slug: "last" });

    const renderContent = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<ReactNode>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValue(<div>content</div>);

    render(
      <StoryblokPreviewRsc renderContent={renderContent} debounceMs={0}>
        <div>initial</div>
      </StoryblokPreviewRsc>,
    );

    await vi.waitFor(() => expect(editorCallback).toBeDefined());

    // First event starts the in-flight action
    await act(async () => {
      editorCallback!(firstStory);
      vi.advanceTimersByTime(0);
      await vi.runAllTimersAsync();
    });

    // Two more events arrive mid-flight — only the last should be queued
    await act(async () => {
      editorCallback!(middleStory);
      vi.advanceTimersByTime(0);
      await vi.runAllTimersAsync();
    });
    await act(async () => {
      editorCallback!(lastStory);
      vi.advanceTimersByTime(0);
      await vi.runAllTimersAsync();
    });

    expect(renderContent).toHaveBeenCalledOnce();

    await act(async () => {
      resolveFirst(<div>first</div>);
      await vi.runAllTimersAsync();
    });

    // Only two calls total: first + last. middle must have been discarded.
    expect(renderContent).toHaveBeenCalledTimes(2);
    expect(renderContent).toHaveBeenNthCalledWith(2, lastStory);
    expect(renderContent).not.toHaveBeenCalledWith(middleStory);
  });

  it("runs the queued story even when the in-flight action rejects", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    let rejectFirst!: (err: Error) => void;
    const firstStory = makeStory({ slug: "first" });
    const secondStory = makeStory({ slug: "second" });

    const renderContent = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<ReactNode>((_, reject) => {
            rejectFirst = reject;
          }),
      )
      .mockResolvedValueOnce(<div data-testid="second-live">second</div>);

    const { getByTestId } = render(
      <StoryblokPreviewRsc renderContent={renderContent} debounceMs={0}>
        <div data-testid="initial">initial</div>
      </StoryblokPreviewRsc>,
    );

    await vi.waitFor(() => expect(editorCallback).toBeDefined());

    // Start first (in-flight), then queue second
    await act(async () => {
      editorCallback!(firstStory);
      vi.advanceTimersByTime(0);
      await vi.runAllTimersAsync();
    });
    await act(async () => {
      editorCallback!(secondStory);
      vi.advanceTimersByTime(0);
      await vi.runAllTimersAsync();
    });

    expect(renderContent).toHaveBeenCalledOnce();

    // Rejecting the first should still trigger the queued second
    await act(async () => {
      rejectFirst(new Error("server error"));
      await vi.runAllTimersAsync();
    });

    expect(renderContent).toHaveBeenCalledTimes(2);
    expect(renderContent).toHaveBeenNthCalledWith(2, secondStory);
    expect(getByTestId("second-live")).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it("unsubscribes and clears the debounce timer on unmount", async () => {
    const renderContent = vi.fn();
    const { unmount } = render(
      <StoryblokPreviewRsc renderContent={renderContent} debounceMs={200}>
        <div>initial</div>
      </StoryblokPreviewRsc>,
    );

    await vi.waitFor(() => expect(editorCallback).toBeDefined());

    const updatedStory = makeStory({ slug: "updated" });
    act(() => editorCallback!(updatedStory));

    unmount();

    await act(async () => {
      vi.advanceTimersByTime(200);
      await vi.runAllTimersAsync();
    });

    expect(renderContent).not.toHaveBeenCalled();
    expect(mockUnsubscribe).toHaveBeenCalledOnce();
  });
});
