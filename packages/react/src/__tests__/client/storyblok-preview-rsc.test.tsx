import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, act } from "@testing-library/react";
import type { Story } from "@storyblok/api-client";
import { onStoryblokEditorEvent } from "@storyblok/live-preview";
import { StoryblokPreviewRsc } from "../../client/StoryblokPreviewRsc";

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
    // Run past the debounce window, then flush all remaining timers and
    // microtasks (including resolved Promise chains and React re-renders).
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

    // Fire event — renderContent should NOT be called yet (50ms debounce)
    act(() => editorCallback!(updatedStory));
    expect(renderContent).not.toHaveBeenCalled();

    // Advance past the debounce window
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
    // Advance only part of the debounce window — timer should be reset
    await act(async () => vi.advanceTimersByTime(50));

    act(() => editorCallback!(secondStory));
    // Advance past the full debounce window from the second event
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
    let resolveContent!: (node: React.ReactNode) => void;
    const renderContent = vi.fn(
      () =>
        new Promise<React.ReactNode>((resolve) => {
          resolveContent = resolve;
        }),
    );

    const { getByTestId, queryByTestId } = render(
      <StoryblokPreviewRsc renderContent={renderContent} debounceMs={0}>
        <div data-testid="initial">initial</div>
      </StoryblokPreviewRsc>,
    );

    await vi.waitFor(() => expect(editorCallback).toBeDefined());

    // Fire event — renderContent returns a never-yet-resolved promise
    await act(async () => {
      editorCallback!(updatedStory);
      vi.advanceTimersByTime(0);
      await vi.runAllTimersAsync();
    });

    // Promise is still pending — Suspense shows children as fallback
    expect(getByTestId("initial")).toBeInTheDocument();
    expect(queryByTestId("live")).toBeNull();

    // Resolve and confirm new content appears
    await act(async () => {
      resolveContent(<div data-testid="live">resolved</div>);
      await vi.runAllTimersAsync();
    });

    expect(getByTestId("live")).toBeInTheDocument();
  });

  it("shows the previously committed content as Suspense fallback on subsequent updates", async () => {
    const firstStory = makeStory({ slug: "first" });
    const secondStory = makeStory({ slug: "second" });
    let resolveSecond!: (node: React.ReactNode) => void;

    const renderContent = vi
      .fn()
      .mockResolvedValueOnce(<div data-testid="first-live">first live</div>)
      .mockImplementationOnce(
        () =>
          new Promise<React.ReactNode>((resolve) => {
            resolveSecond = resolve;
          }),
      );

    const { getByTestId, getAllByTestId, queryByTestId } = render(
      <StoryblokPreviewRsc renderContent={renderContent} debounceMs={0}>
        <div data-testid="initial">initial</div>
      </StoryblokPreviewRsc>,
    );

    await vi.waitFor(() => expect(editorCallback).toBeDefined());

    // First update — resolves immediately
    await fireEditorEvent(editorCallback!, firstStory);
    expect(getByTestId("first-live")).toBeInTheDocument();

    // Second update — pending; committed content from first update is the fallback
    await act(async () => {
      editorCallback!(secondStory);
      vi.advanceTimersByTime(0);
      await vi.runAllTimersAsync();
    });

    // "first-live" (committed) is shown as Suspense fallback while the second
    // promise is pending. React concurrent mode keeps the previous LiveContent
    // output hidden in the DOM too (display:none), so use getAllByTestId and
    // confirm at least one visible node exists.
    const firstLiveNodes = getAllByTestId("first-live");
    expect(firstLiveNodes.length).toBeGreaterThanOrEqual(1);
    const visibleFirstLive = firstLiveNodes.find((el) => getComputedStyle(el).display !== "none");
    expect(visibleFirstLive).toBeDefined();
    expect(queryByTestId("second-live")).toBeNull();

    // Resolve second
    await act(async () => {
      resolveSecond(<div data-testid="second-live">second live</div>);
      await vi.runAllTimersAsync();
    });

    expect(getByTestId("second-live")).toBeInTheDocument();
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

    // Unmount before the debounce fires
    unmount();

    await act(async () => {
      vi.advanceTimersByTime(200);
      await vi.runAllTimersAsync();
    });

    // Server action must not be called after unmount
    expect(renderContent).not.toHaveBeenCalled();
    expect(mockUnsubscribe).toHaveBeenCalledOnce();
  });
});
