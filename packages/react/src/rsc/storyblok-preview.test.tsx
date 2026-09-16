import { type ReactNode, StrictMode, Suspense, useState } from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { onStoryblokEditorEvent } from "@storyblok/live-preview";
import type { Story } from "../types";
import { StoryblokPreview } from "./storyblok-preview";

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

/**
 * Classic "throw a promise to suspend" resource, used to prove a Suspense
 * boundary nested inside the *resolved* content still streams independently —
 * i.e. awaiting `renderContent(story)` only resolves the outer shell, it does
 * not force-resolve everything inside it.
 */
function createResource<T>(promise: Promise<T>) {
  let status: "pending" | "success" | "error" = "pending";
  let result: T | unknown;
  const suspender = promise.then(
    (value) => {
      status = "success";
      result = value;
    },
    (error) => {
      status = "error";
      result = error;
    },
  );
  return {
    read(): T {
      if (status === "pending") {
        throw suspender;
      }
      if (status === "error") {
        throw result;
      }
      return result as T;
    },
  };
}

function SuspendingChild({
  resource,
  testId,
}: {
  resource: ReturnType<typeof createResource<string>>;
  testId: string;
}) {
  return <div data-testid={testId}>{resource.read()}</div>;
}

function StatefulContent({ label }: { label: string }) {
  const [count, setCount] = useState(0);
  return (
    <button data-testid="stateful-content" onClick={() => setCount((value) => value + 1)}>
      {label}:{count}
    </button>
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("StoryblokPreview (server mode)", () => {
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

  it("awaits renderContent once for the initial story and renders the result", async () => {
    const story = makeStory({ slug: "initial" });
    const renderContent = vi.fn().mockResolvedValue(<div data-testid="initial">initial</div>);

    const element = await StoryblokPreview({ story, renderContent });
    const { getByTestId } = render(element);

    expect(getByTestId("initial")).toBeInTheDocument();
    expect(renderContent).toHaveBeenCalledOnce();
    expect(renderContent).toHaveBeenCalledWith(story);
  });

  // Regression test: awaiting renderContent(story) for the initial paint only
  // resolves the outer shell it returns — a Suspense boundary nested *inside*
  // that result still suspends and streams independently, and is never
  // intercepted or stored in useState by StoryblokPreview.
  it("never intercepts a nested Suspense boundary inside the resolved initial content", async () => {
    const story = makeStory();
    let resolveChild!: () => void;
    const childPromise = new Promise<string>((resolve) => {
      resolveChild = () => resolve("nested content");
    });
    const resource = createResource(childPromise);

    const renderContent = vi.fn().mockResolvedValue(
      <Suspense fallback={<div data-testid="fallback">loading…</div>}>
        <SuspendingChild resource={resource} testId="nested" />
      </Suspense>,
    );

    const element = await StoryblokPreview({ story, renderContent });
    const { getByTestId, queryByTestId } = render(element);

    // renderContent has already resolved (it was awaited) — but the nested
    // Suspense boundary inside its result is independent and still pending.
    expect(getByTestId("fallback")).toBeInTheDocument();
    expect(queryByTestId("nested")).toBeNull();

    await act(async () => {
      resolveChild();
      await childPromise;
    });

    expect(getByTestId("nested")).toBeInTheDocument();
  });

  it("propagates a rejection from the initial renderContent call", async () => {
    const story = makeStory();
    const renderContent = vi.fn().mockRejectedValue(new Error("initial render failed"));

    await expect(StoryblokPreview({ story, renderContent })).rejects.toThrow(
      "initial render failed",
    );
  });

  it("calls renderContent with the updated story after an editor event and debounce", async () => {
    const story = makeStory();
    const updatedStory = makeStory({ slug: "updated" });
    const renderContent = vi
      .fn()
      .mockResolvedValueOnce(<div>initial</div>)
      .mockResolvedValueOnce(<div>live</div>);

    const element = await StoryblokPreview({ story, renderContent, debounceMs: 50 });
    render(element);

    await vi.waitFor(() => expect(editorCallback).toBeDefined());

    act(() => editorCallback!(updatedStory));
    expect(renderContent).toHaveBeenCalledOnce();

    await act(async () => {
      vi.advanceTimersByTime(50);
      await vi.runAllTimersAsync();
    });

    expect(renderContent).toHaveBeenCalledTimes(2);
    expect(renderContent).toHaveBeenNthCalledWith(2, updatedStory);
  });

  // Regression test: React 18+ Strict Mode (dev only) mounts, cleans up, then
  // remounts the same component instance to surface missing cleanup handling.
  // A prior bug set `mounted` to false in that cleanup and never reset it back
  // to true on the simulated remount, so every editor event silently no-opped
  // under Strict Mode — live editing appeared completely broken in Next.js dev
  // (which enables Strict Mode by default).
  it("still applies live updates under Strict Mode", async () => {
    const story = makeStory();
    const updatedStory = makeStory({ slug: "updated" });
    const renderContent = vi
      .fn()
      .mockResolvedValueOnce(<div>initial</div>)
      .mockResolvedValueOnce(<div>live</div>);

    const element = await StoryblokPreview({ story, renderContent, debounceMs: 0 });
    render(<StrictMode>{element}</StrictMode>);

    await vi.waitFor(() => expect(editorCallback).toBeDefined());
    await fireEditorEvent(editorCallback!, updatedStory);

    expect(renderContent).toHaveBeenCalledTimes(2);
    expect(renderContent).toHaveBeenNthCalledWith(2, updatedStory);
  });

  it("debounces rapid editor events — only calls renderContent once for the last event", async () => {
    const story = makeStory();
    const firstStory = makeStory({ slug: "first" });
    const secondStory = makeStory({ slug: "second" });
    const renderContent = vi.fn().mockResolvedValue(<div>content</div>);

    const element = await StoryblokPreview({ story, renderContent, debounceMs: 100 });
    render(element);

    await vi.waitFor(() => expect(editorCallback).toBeDefined());

    act(() => editorCallback!(firstStory));
    await act(async () => vi.advanceTimersByTime(50));

    act(() => editorCallback!(secondStory));
    await act(async () => {
      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync();
    });

    expect(renderContent).toHaveBeenCalledTimes(2); // 1 initial + 1 update
    expect(renderContent).toHaveBeenNthCalledWith(2, secondStory);
  });

  it("shows the new content after renderContent resolves", async () => {
    const story = makeStory();
    const updatedStory = makeStory({ slug: "updated" });
    const renderContent = vi
      .fn()
      .mockResolvedValueOnce(<div data-testid="initial">initial</div>)
      .mockResolvedValueOnce(<div data-testid="live">live content</div>);

    const element = await StoryblokPreview({ story, renderContent, debounceMs: 0 });
    const { getByTestId } = render(element);

    await vi.waitFor(() => expect(editorCallback).toBeDefined());
    await fireEditorEvent(editorCallback!, updatedStory);

    expect(getByTestId("live")).toBeInTheDocument();
    expect(getByTestId("live")).toHaveTextContent("live content");
  });

  it("preserves state across the first live update", async () => {
    const story = makeStory();
    const updatedStory = makeStory({ slug: "updated" });
    const renderContent = vi
      .fn()
      .mockResolvedValueOnce(<StatefulContent label="initial" />)
      .mockResolvedValueOnce(<StatefulContent label="updated" />);

    const element = await StoryblokPreview({ story, renderContent, debounceMs: 0 });
    const { getByTestId } = render(element);

    await vi.waitFor(() => expect(editorCallback).toBeDefined());
    act(() => getByTestId("stateful-content").click());
    expect(getByTestId("stateful-content")).toHaveTextContent("initial:1");

    await fireEditorEvent(editorCallback!, updatedStory);

    expect(getByTestId("stateful-content")).toHaveTextContent("updated:1");
  });

  it("shows the previous content while renderContent is pending for an update", async () => {
    const story = makeStory();
    const updatedStory = makeStory({ slug: "updated" });
    let resolveContent!: (node: ReactNode) => void;
    const renderContent = vi
      .fn()
      .mockResolvedValueOnce(<div data-testid="initial">initial</div>)
      .mockImplementationOnce(
        () =>
          new Promise<ReactNode>((resolve) => {
            resolveContent = resolve;
          }),
      );

    const element = await StoryblokPreview({ story, renderContent, debounceMs: 0 });
    const { getByTestId, queryByTestId } = render(element);

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
    const story = makeStory();
    const firstStory = makeStory({ slug: "first" });
    const secondStory = makeStory({ slug: "second" });
    let resolveSecond!: (node: ReactNode) => void;

    const renderContent = vi
      .fn()
      .mockResolvedValueOnce(<div data-testid="initial">initial</div>)
      .mockResolvedValueOnce(<div data-testid="first-live">first live</div>)
      .mockImplementationOnce(
        () =>
          new Promise<ReactNode>((resolve) => {
            resolveSecond = resolve;
          }),
      );

    const element = await StoryblokPreview({ story, renderContent, debounceMs: 0 });
    const { getByTestId, getAllByTestId, queryByTestId } = render(element);

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
    // Exactly one copy — no duplicate DOM from a stale Suspense fallback
    expect(getAllByTestId("first-live")).toHaveLength(1);
    expect(queryByTestId("second-live")).toBeNull();

    await act(async () => {
      resolveSecond(<div data-testid="second-live">second live</div>);
      await vi.runAllTimersAsync();
    });

    expect(getByTestId("second-live")).toBeInTheDocument();
  });

  it("shows the previous content when an update rejects, then recovers on the next event", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const story = makeStory();
    const firstStory = makeStory({ slug: "first" });
    const secondStory = makeStory({ slug: "second" });

    const renderContent = vi
      .fn()
      .mockResolvedValueOnce(<div data-testid="initial">initial</div>)
      .mockRejectedValueOnce(new Error("server error"))
      .mockResolvedValueOnce(<div data-testid="recovered">recovered content</div>);

    const element = await StoryblokPreview({ story, renderContent, debounceMs: 0 });
    const { getByTestId, queryByTestId } = render(element);

    await vi.waitFor(() => expect(editorCallback).toBeDefined());

    // First update — renderContent rejects
    await fireEditorEvent(editorCallback!, firstStory);

    // Error boundary must keep the previous content visible, not crash the page
    expect(getByTestId("initial")).toBeInTheDocument();
    expect(queryByTestId("recovered")).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[Storyblok]"),
      expect.any(Error),
    );

    // Second update — renderContent resolves → boundary resets and shows new content
    await fireEditorEvent(editorCallback!, secondStory);
    expect(getByTestId("recovered")).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  // ─── Concurrent action gating ────────────────────────────────────────────
  //
  // Each test below fires an event while a server action is still in-flight.
  // The desired behaviour is: at most one action running at a time; the latest
  // story that arrived mid-flight is queued and dispatched once the current
  // action settles (resolve or reject); intermediate stories are discarded.

  it("does not start a second renderContent call while the first update is in-flight", async () => {
    const story = makeStory();
    let resolveFirst!: (node: ReactNode) => void;
    const firstStory = makeStory({ slug: "first" });
    const secondStory = makeStory({ slug: "second" });

    const renderContent = vi
      .fn()
      .mockResolvedValueOnce(<div>initial</div>)
      .mockImplementationOnce(
        () =>
          new Promise<ReactNode>((resolve) => {
            resolveFirst = resolve;
          }),
      );

    const element = await StoryblokPreview({ story, renderContent, debounceMs: 0 });
    render(element);

    await vi.waitFor(() => expect(editorCallback).toBeDefined());

    // First event — action is now in-flight (unresolved promise)
    await act(async () => {
      editorCallback!(firstStory);
      vi.advanceTimersByTime(0);
      await vi.runAllTimersAsync();
    });

    expect(renderContent).toHaveBeenCalledTimes(2); // initial + first

    // Second event fires while first is still pending
    await act(async () => {
      editorCallback!(secondStory);
      vi.advanceTimersByTime(0);
      await vi.runAllTimersAsync();
    });

    // Must still be two — the second action must not have started yet
    expect(renderContent).toHaveBeenCalledTimes(2);

    // Clean up — resolve so the component doesn't leak a pending promise
    await act(async () => {
      resolveFirst(<div>first</div>);
      await vi.runAllTimersAsync();
    });
  });

  it("runs the queued story after the in-flight action resolves", async () => {
    const story = makeStory();
    let resolveFirst!: (node: ReactNode) => void;
    const firstStory = makeStory({ slug: "first" });
    const secondStory = makeStory({ slug: "second" });

    const renderContent = vi
      .fn()
      .mockResolvedValueOnce(<div>initial</div>)
      .mockImplementationOnce(
        () =>
          new Promise<ReactNode>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce(<div data-testid="second-live">second</div>);

    const element = await StoryblokPreview({ story, renderContent, debounceMs: 0 });
    const { getByTestId } = render(element);

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

    expect(renderContent).toHaveBeenCalledTimes(2); // initial + first (in-flight)

    // Resolving the first should trigger the queued second
    await act(async () => {
      resolveFirst(<div data-testid="first-live">first</div>);
      await vi.runAllTimersAsync();
    });

    expect(renderContent).toHaveBeenCalledTimes(3);
    expect(renderContent).toHaveBeenNthCalledWith(3, secondStory);
    expect(getByTestId("second-live")).toBeInTheDocument();
  });

  it("discards intermediate stories and runs only the latest queued story", async () => {
    const story = makeStory();
    let resolveFirst!: (node: ReactNode) => void;
    const firstStory = makeStory({ slug: "first" });
    const middleStory = makeStory({ slug: "middle" });
    const lastStory = makeStory({ slug: "last" });

    const renderContent = vi
      .fn()
      .mockResolvedValueOnce(<div>initial</div>)
      .mockImplementationOnce(
        () =>
          new Promise<ReactNode>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValue(<div>content</div>);

    const element = await StoryblokPreview({ story, renderContent, debounceMs: 0 });
    render(element);

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

    expect(renderContent).toHaveBeenCalledTimes(2); // initial + first (in-flight)

    await act(async () => {
      resolveFirst(<div>first</div>);
      await vi.runAllTimersAsync();
    });

    // initial + first + last. middle must have been discarded.
    expect(renderContent).toHaveBeenCalledTimes(3);
    expect(renderContent).toHaveBeenNthCalledWith(3, lastStory);
    expect(renderContent).not.toHaveBeenCalledWith(middleStory);
  });

  it("runs the queued story even when the in-flight action rejects", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const story = makeStory();
    let rejectFirst!: (err: Error) => void;
    const firstStory = makeStory({ slug: "first" });
    const secondStory = makeStory({ slug: "second" });

    const renderContent = vi
      .fn()
      .mockResolvedValueOnce(<div data-testid="initial">initial</div>)
      .mockImplementationOnce(
        () =>
          new Promise<ReactNode>((_, reject) => {
            rejectFirst = reject;
          }),
      )
      .mockResolvedValueOnce(<div data-testid="second-live">second</div>);

    const element = await StoryblokPreview({ story, renderContent, debounceMs: 0 });
    const { getByTestId } = render(element);

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

    expect(renderContent).toHaveBeenCalledTimes(2);

    // Rejecting the first should still trigger the queued second
    await act(async () => {
      rejectFirst(new Error("server error"));
      await vi.runAllTimersAsync();
    });

    expect(renderContent).toHaveBeenCalledTimes(3);
    expect(renderContent).toHaveBeenNthCalledWith(3, secondStory);
    expect(getByTestId("second-live")).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it("should not run a queued story after unmount", async () => {
    const story = makeStory();
    let resolveFirst!: (node: ReactNode) => void;
    const firstStory = makeStory({ slug: "first" });
    const queuedStory = makeStory({ slug: "queued" });
    const renderContent = vi
      .fn()
      .mockResolvedValueOnce(<div>initial</div>)
      .mockImplementationOnce(
        () =>
          new Promise<ReactNode>((resolve) => {
            resolveFirst = resolve;
          }),
      );

    const element = await StoryblokPreview({ story, renderContent, debounceMs: 0 });
    const { unmount } = render(element);

    await vi.waitFor(() => expect(editorCallback).toBeDefined());

    await act(async () => {
      editorCallback!(firstStory);
      await vi.runAllTimersAsync();
    });

    await act(async () => {
      editorCallback!(queuedStory);
      await vi.runAllTimersAsync();
    });

    expect(renderContent).toHaveBeenCalledTimes(2);

    unmount();

    await act(async () => {
      resolveFirst(<div>first</div>);
      await vi.runAllTimersAsync();
    });

    expect(renderContent).toHaveBeenCalledTimes(2);
  });

  it("unsubscribes and clears the debounce timer on unmount", async () => {
    const story = makeStory();
    const renderContent = vi.fn().mockResolvedValue(<div>initial</div>);
    const element = await StoryblokPreview({ story, renderContent, debounceMs: 200 });
    const { unmount } = render(element);

    await vi.waitFor(() => expect(editorCallback).toBeDefined());

    const updatedStory = makeStory({ slug: "updated" });
    act(() => editorCallback!(updatedStory));

    unmount();

    await act(async () => {
      vi.advanceTimersByTime(200);
      await vi.runAllTimersAsync();
    });

    expect(renderContent).toHaveBeenCalledOnce(); // only the initial call
    expect(mockUnsubscribe).toHaveBeenCalledOnce();
  });
});
