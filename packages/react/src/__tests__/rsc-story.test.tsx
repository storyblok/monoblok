import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import type { ISbStoryData } from "@storyblok/js";

import StoryblokStory from "../rsc/story";
import StoryblokServerStory from "../server/server-story";
import { setComponents } from "../core/state";

// StoryblokLiveEditing registers the bridge on mount; for rendering tests we
// keep `isVisualEditor` falsy so it only renders the server output.
vi.mock("../utils", async () => {
  const actual = await vi.importActual<typeof import("../utils")>("../utils");
  return {
    ...actual,
    isVisualEditor: vi.fn(() => false),
    isBridgeLoaded: vi.fn(() => false),
  };
});

vi.mock("@storyblok/js", () => ({
  registerStoryblokBridge: vi.fn(),
  loadStoryblokBridge: vi.fn(() => Promise.resolve()),
}));

function Marker({ blok, className }: { blok: { label?: string }; className?: string }) {
  return (
    <span data-testid="marker" className={className}>
      {blok?.label ?? "no-label"}
    </span>
  );
}

const story = (label: string) =>
  ({
    id: 1,
    uuid: "u-1",
    content: { component: "marker", label },
  }) as unknown as ISbStoryData;

describe("storyblokStory", () => {
  beforeEach(() => {
    setComponents({ marker: Marker });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the server story with its props", () => {
    const { getByTestId } = render(<StoryblokStory story={story("server")} className="hero" />);

    expect(getByTestId("marker").textContent).toBe("server");
    expect(getByTestId("marker").className).toBe("hero");
  });

  it("parses string content", () => {
    const server = {
      id: 2,
      content: JSON.stringify({ component: "marker", label: "from-string" }),
    } as unknown as ISbStoryData;

    const { getByTestId } = render(<StoryblokStory story={server} />);

    expect(getByTestId("marker").textContent).toBe("from-string");
  });

  it("ignores a stale shared cache left by an earlier version", () => {
    // Earlier versions served live edits from `globalThis.storyCache`, which any
    // caller of the public Server Action could fill. Nothing reads it anymore.
    Reflect.set(globalThis, "storyCache", new Map([["1", story("injected")]]));
    try {
      const { getAllByTestId } = render(
        <>
          <StoryblokStory story={story("server")} />
          <StoryblokServerStory story={story("server")} />
        </>,
      );

      expect(getAllByTestId("marker").map((el) => el.textContent)).toEqual(["server", "server"]);
    } finally {
      Reflect.deleteProperty(globalThis, "storyCache");
    }
  });
});
