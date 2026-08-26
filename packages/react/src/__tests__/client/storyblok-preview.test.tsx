import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, act } from "@testing-library/react";
import type { Story } from "@storyblok/api-client";
import { onStoryblokEditorEvent } from "@storyblok/live-preview";
import { StoryblokPreview } from "../../client/StoryblokPreview";

// ─── Mock @storyblok/live-preview ─────────────────────────────────────────────

// StoryblokPreview delegates to useStoryblokState which calls onStoryblokEditorEvent.
vi.mock("@storyblok/live-preview", () => ({
  onStoryblokEditorEvent: vi.fn(),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

type EditorCallback = (story: unknown) => void;

function makeStory(overrides: Record<string, unknown> = {}): Story {
  return { id: "1", slug: "home", content: {}, ...overrides } as unknown as Story;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("StoryblokPreview", () => {
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

  it("calls the render prop with the initial story", () => {
    const story = makeStory({ slug: "initial" });
    const children = vi.fn((s: Story) => <div data-testid="content">{(s as any).slug}</div>);

    const { getByTestId } = render(<StoryblokPreview story={story}>{children}</StoryblokPreview>);

    expect(getByTestId("content")).toHaveTextContent("initial");
    expect(children).toHaveBeenCalledWith(story);
  });

  it("calls the render prop with the updated story on editor events", async () => {
    const initial = makeStory({ slug: "initial" });
    const updated = makeStory({ slug: "updated" });

    const { getByTestId } = render(
      <StoryblokPreview story={initial}>
        {(s) => <div data-testid="content">{(s as any).slug}</div>}
      </StoryblokPreview>,
    );

    await vi.waitFor(() => expect(editorCallback).toBeDefined());

    act(() => editorCallback!(updated));

    expect(getByTestId("content")).toHaveTextContent("updated");
  });

  it("re-renders whenever the editor fires a new event", async () => {
    const initial = makeStory({ slug: "v1" });
    const renderCount = vi.fn();

    const { getByTestId } = render(
      <StoryblokPreview story={initial}>
        {(s) => {
          renderCount();
          return <div data-testid="slug">{(s as any).slug}</div>;
        }}
      </StoryblokPreview>,
    );

    await vi.waitFor(() => expect(editorCallback).toBeDefined());

    act(() => editorCallback!(makeStory({ slug: "v2" })));
    expect(getByTestId("slug")).toHaveTextContent("v2");

    act(() => editorCallback!(makeStory({ slug: "v3" })));
    expect(getByTestId("slug")).toHaveTextContent("v3");
  });

  it("unsubscribes from editor events when unmounted", async () => {
    const story = makeStory();
    const { unmount } = render(
      <StoryblokPreview story={story}>{(s) => <div>{(s as any).slug}</div>}</StoryblokPreview>,
    );

    await vi.waitFor(() => expect(editorCallback).toBeDefined());

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalledOnce();
  });

  it("does not update after unmount", async () => {
    const initial = makeStory({ slug: "before" });
    let renderedSlug = "";

    const { unmount } = render(
      <StoryblokPreview story={initial}>
        {(s) => {
          renderedSlug = (s as any).slug;
          return <div>{renderedSlug}</div>;
        }}
      </StoryblokPreview>,
    );

    await vi.waitFor(() => expect(editorCallback).toBeDefined());

    unmount();
    act(() => editorCallback!(makeStory({ slug: "after" })));

    expect(renderedSlug).toBe("before");
  });

  describe("with debounceMs option", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("delays render prop update until debounce settles", async () => {
      const initial = makeStory({ slug: "initial" });
      const updated = makeStory({ slug: "updated" });

      const { getByTestId } = render(
        <StoryblokPreview story={initial} debounceMs={100}>
          {(s) => <div data-testid="slug">{(s as any).slug}</div>}
        </StoryblokPreview>,
      );

      await vi.waitFor(() => expect(editorCallback).toBeDefined());

      act(() => editorCallback!(updated));
      expect(getByTestId("slug")).toHaveTextContent("initial");

      await act(async () => {
        vi.advanceTimersByTime(100);
        await vi.runAllTimersAsync();
      });

      expect(getByTestId("slug")).toHaveTextContent("updated");
    });
  });
});
