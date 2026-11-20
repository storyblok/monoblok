import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import type { ISbStoryData } from "@storyblok/js";

// Import after mocks
import StoryblokLiveEditing from "../rsc/live-editing";
import { isBridgeLoaded, isVisualEditor } from "../utils";
import { loadStoryblokBridge, registerStoryblokBridge } from "@storyblok/js";
import { liveEditUpdateAction } from "../rsc/live-edit-update-action";

// Mock dependencies - need to define functions inline to avoid hoisting issues
vi.mock("../rsc/live-edit-update-action", () => ({
  liveEditUpdateAction: vi.fn(),
}));

vi.mock("@storyblok/js", () => ({
  registerStoryblokBridge: vi.fn(),
  loadStoryblokBridge: vi.fn(() => Promise.resolve()),
}));

vi.mock("../utils", () => ({
  isVisualEditor: vi.fn(() => false),
  isBridgeLoaded: vi.fn(() => false),
}));

const EDITOR_TOKEN = {
  spaceId: "12345",
  timestamp: "1700000000",
  token: "0123456789abcdef0123456789abcdef01234567",
};
const EDITOR_SEARCH = `?_storyblok=10&_storyblok_tk[space_id]=${EDITOR_TOKEN.spaceId}&_storyblok_tk[timestamp]=${EDITOR_TOKEN.timestamp}&_storyblok_tk[token]=${EDITOR_TOKEN.token}`;

describe("storyblokLiveEditing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isVisualEditor).mockReturnValue(false);
    vi.mocked(isBridgeLoaded).mockReturnValue(false);

    // Mock window
    vi.stubGlobal("window", {
      storyblokRegisterEvent: undefined,
      location: {
        search: EDITOR_SEARCH,
        pathname: "/",
      },
      self: {},
      top: {},
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should return null when not in visual editor", () => {
    vi.mocked(isVisualEditor).mockReturnValue(false);

    const { container } = render(
      React.createElement(StoryblokLiveEditing, {
        story: { uuid: "123", id: 456 } as ISbStoryData,
        bridgeOptions: {},
      }),
    );

    expect(container.firstChild).toBeNull();
    expect(loadStoryblokBridge).not.toHaveBeenCalled();
  });

  it("should load bridge and register when in visual editor", async () => {
    vi.mocked(isVisualEditor).mockReturnValue(true);
    vi.mocked(isBridgeLoaded).mockReturnValue(false);

    const story = { id: 789, uuid: "test-uuid" } as ISbStoryData;

    const { container } = render(
      React.createElement(StoryblokLiveEditing, {
        story,
        bridgeOptions: { resolveRelations: ["test.relation"] },
      }),
    );

    // Component should return null but load bridge
    expect(container.firstChild).toBeNull();

    // Wait for async bridge loading
    await vi.waitFor(() => {
      expect(loadStoryblokBridge).toHaveBeenCalled();
    });
  });

  it("should handle null story gracefully", () => {
    vi.mocked(isVisualEditor).mockReturnValue(false);

    const { container } = render(
      React.createElement(StoryblokLiveEditing, {
        // @ts-expect-error - Testing invalid input
        story: null,
        bridgeOptions: {},
      }),
    );

    expect(container.firstChild).toBeNull();
  });

  it("should not load bridge when already loaded", () => {
    vi.mocked(isVisualEditor).mockReturnValue(true);
    vi.mocked(isBridgeLoaded).mockReturnValue(true);

    render(
      React.createElement(StoryblokLiveEditing, {
        story: { id: 123, uuid: "test" } as ISbStoryData,
        bridgeOptions: {},
      }),
    );

    // Since bridge is already loaded, we should not call loadStoryblokBridge
    expect(loadStoryblokBridge).not.toHaveBeenCalled();
  });

  it("should call liveEditUpdateAction for regular live-edit events", async () => {
    vi.mocked(isVisualEditor).mockReturnValue(true);
    vi.mocked(isBridgeLoaded).mockReturnValue(true);

    let captured: ((story: ISbStoryData) => void) | null = null;
    vi.mocked(registerStoryblokBridge).mockImplementation((_id, cb) => {
      captured = cb as (story: ISbStoryData) => void;
    });

    render(
      React.createElement(StoryblokLiveEditing, {
        story: { id: 10, uuid: "uuid-10" } as ISbStoryData,
        bridgeOptions: {},
      }),
    );

    await vi.waitFor(() => expect(captured).not.toBeNull());

    captured!({ id: 10, uuid: "uuid-10", content: { _uid: "x" } } as ISbStoryData);

    await vi.waitFor(() => expect(liveEditUpdateAction).toHaveBeenCalled());
    expect(liveEditUpdateAction).toHaveBeenCalledWith(
      expect.objectContaining({
        story: expect.objectContaining({ uuid: "uuid-10" }),
        pathToRevalidate: "/",
        editorToken: EDITOR_TOKEN,
      }),
    );
  });

  it("should not call liveEditUpdateAction without a Visual Editor token", async () => {
    vi.mocked(isVisualEditor).mockReturnValue(true);
    vi.mocked(isBridgeLoaded).mockReturnValue(true);
    window.location.search = "?_storyblok=10";
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    let captured: ((story: ISbStoryData) => void) | null = null;
    vi.mocked(registerStoryblokBridge).mockImplementation((_id, cb) => {
      captured = cb as (story: ISbStoryData) => void;
    });

    render(
      React.createElement(StoryblokLiveEditing, {
        story: { id: 10, uuid: "uuid-10" } as ISbStoryData,
        bridgeOptions: {},
      }),
    );

    await vi.waitFor(() => expect(captured).not.toBeNull());
    await captured!({ id: 10, content: { _uid: "x" } } as ISbStoryData);

    expect(warnSpy).toHaveBeenCalled();
    expect(liveEditUpdateAction).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("should call liveEditUpdateAction with the same payload shape for Visual History events", async () => {
    vi.mocked(isVisualEditor).mockReturnValue(true);
    vi.mocked(isBridgeLoaded).mockReturnValue(true);

    let captured: ((story: ISbStoryData) => void) | null = null;
    vi.mocked(registerStoryblokBridge).mockImplementation((_id, cb) => {
      captured = cb as (story: ISbStoryData) => void;
    });

    render(
      React.createElement(StoryblokLiveEditing, {
        story: { id: 42, uuid: "uuid-42" } as ISbStoryData,
        bridgeOptions: {},
      }),
    );

    await vi.waitFor(() => expect(captured).not.toBeNull());

    // Visual History payload: minimal, no uuid
    captured!({ id: 42, content: { _uid: "hist" } } as unknown as ISbStoryData);

    await vi.waitFor(() => expect(liveEditUpdateAction).toHaveBeenCalled());
    expect(liveEditUpdateAction).toHaveBeenCalledWith(
      expect.objectContaining({
        story: expect.objectContaining({ id: 42 }),
        pathToRevalidate: "/",
        editorToken: EDITOR_TOKEN,
      }),
    );
  });
});
