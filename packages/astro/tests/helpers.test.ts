import { afterEach, describe, expect, it } from "vitest";
import { getLiveStory, getPayload, initStoryblokBridge, useStoryblokApi } from "../src/lib/helpers";
import type { ISbStoryData, StoryblokClient } from "../src/types";

function makeStory(name = "Home"): ISbStoryData {
  return {
    name,
    id: 1,
    uuid: "story-uuid",
    slug: "home",
    full_slug: "home",
    content: { component: "page", _uid: "uid-1" },
  } as ISbStoryData;
}

describe("useStoryblokApi", () => {
  afterEach(() => {
    globalThis.storyblokApiInstance = undefined;
  });

  it("should return the initialized client instance", () => {
    const client = {} as StoryblokClient;
    globalThis.storyblokApiInstance = client;

    expect(useStoryblokApi()).toBe(client);
  });

  it("should throw when the client has not been initialized", () => {
    expect(() => useStoryblokApi()).toThrow(
      "storyblokApiInstance has not been initialized correctly",
    );
  });
});

describe("getLiveStory", () => {
  it("should return the story from the preview data", async () => {
    const story = makeStory();

    await expect(getLiveStory({ locals: { _storyblok_preview_data: { story } } })).resolves.toBe(
      story,
    );
  });

  it("should return null when there is no preview data", async () => {
    await expect(getLiveStory({ locals: {} })).resolves.toBeNull();
  });
});

describe("getPayload", () => {
  it("should return the story and server data from the preview data", async () => {
    const story = makeStory();
    const serverData = { users: ["alice", "bob"] };

    await expect(
      getPayload({ locals: { _storyblok_preview_data: { story, serverData } } }),
    ).resolves.toEqual({ story, serverData });
  });

  it("should return the story without server data when none was provided", async () => {
    const story = makeStory();

    await expect(getPayload({ locals: { _storyblok_preview_data: { story } } })).resolves.toEqual({
      story,
    });
  });

  it("should return an empty payload when there is no preview data", async () => {
    await expect(getPayload({ locals: {} })).resolves.toEqual({});
  });
});

describe("initStoryblokBridge", () => {
  it("should initialize the bridge with the serialized config when given an object", () => {
    const config = { resolveRelations: ["page.author"], preventClicks: true };

    expect(initStoryblokBridge(config)).toBe(
      `const storyblokInstance = new StoryblokBridge(${JSON.stringify(config)});`,
    );
  });

  it("should initialize the bridge without arguments when given a boolean", () => {
    expect(initStoryblokBridge(true)).toBe("const storyblokInstance = new StoryblokBridge();");
  });
});
