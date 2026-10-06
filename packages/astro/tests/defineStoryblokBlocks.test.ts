import { describe, expect, it } from "vitest";
import { defineStoryblokBlocks } from "../src/define-storyblok-blocks";
import { resolveBlockComponent } from "../src/registry";

describe("defineStoryblokBlocks", () => {
  it("registers components and returns StoryblokBlock/StoryblokBlocks", () => {
    const Teaser = {};
    const { StoryblokBlock, StoryblokBlocks } = defineStoryblokBlocks({
      components: { teaser: Teaser },
    });

    expect(StoryblokBlock).toBeDefined();
    expect(StoryblokBlocks).toBeDefined();
    expect(resolveBlockComponent({ component: "teaser" })).toBe(Teaser);
  });

  it("returns the same StoryblokBlock/StoryblokBlocks components across calls", () => {
    const first = defineStoryblokBlocks({ components: {} });
    const second = defineStoryblokBlocks({ components: {} });

    expect(first.StoryblokBlock).toBe(second.StoryblokBlock);
    expect(first.StoryblokBlocks).toBe(second.StoryblokBlocks);
  });

  it("registers the fallback", () => {
    const Fallback = {};
    defineStoryblokBlocks({ components: {}, fallback: Fallback });

    expect(resolveBlockComponent({ component: "unregistered" })).toBe(Fallback);
  });
});
