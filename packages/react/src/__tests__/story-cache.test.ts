import { beforeEach, describe, expect, it } from "vitest";
import type { ISbStoryData } from "@storyblok/js";
import {
  consumeCachedStory,
  setCachedStory,
  STORY_CACHE_MAX_ENTRIES,
  STORY_CACHE_TTL_MS,
} from "../core/story-cache";

const story = (id: number, label = "x") => ({ id, content: { label } }) as unknown as ISbStoryData;

describe("story cache", () => {
  beforeEach(() => {
    globalThis.storyCache = new Map();
  });

  it("serves a fresh entry once", () => {
    setCachedStory(story(1, "cached"), 1_000);
    expect(consumeCachedStory(story(1, "server"), 1_500).content).toEqual({ label: "cached" });
    expect(consumeCachedStory(story(1, "server"), 1_600).content).toEqual({ label: "server" });
  });

  it("ignores and drops expired entries", () => {
    setCachedStory(story(1, "cached"), 1_000);
    const result = consumeCachedStory(story(1, "server"), 1_000 + STORY_CACHE_TTL_MS);
    expect(result.content).toEqual({ label: "server" });
    expect(globalThis.storyCache.size).toBe(0);
  });

  it("bounds the number of entries", () => {
    for (let id = 1; id <= STORY_CACHE_MAX_ENTRIES + 25; id++) {
      setCachedStory(story(id), 1_000);
    }
    expect(globalThis.storyCache.size).toBe(STORY_CACHE_MAX_ENTRIES);
    expect(globalThis.storyCache.has("1")).toBe(false);
    expect(globalThis.storyCache.has(String(STORY_CACHE_MAX_ENTRIES + 25))).toBe(true);
  });
});
