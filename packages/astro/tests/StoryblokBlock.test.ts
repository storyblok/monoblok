import { describe, expect, it, afterEach } from "vitest";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { defineStoryblokBlocks } from "../src/define-storyblok-blocks";
import { setBlocks } from "../src/registry";
import StoryblokBlock from "../src/components/StoryblokBlock.astro";
import StoryblokBlocks from "../src/components/StoryblokBlocks.astro";
import Teaser from "./block-fixtures/Teaser.astro";
import Fallback from "./block-fixtures/Fallback.astro";

describe("StoryblokBlock / StoryblokBlocks", () => {
  afterEach(() => {
    setBlocks({ components: {} });
  });

  it("renders the component resolved for the block type", async () => {
    defineStoryblokBlocks({ components: { teaser: Teaser } });
    const container = await AstroContainer.create();

    const result = await container.renderToString(StoryblokBlock, {
      props: { block: { component: "teaser", headline: "Hello" } },
    });

    expect(result).toContain("Hello");
  });

  it("renders nothing when no component resolves and there is no fallback", async () => {
    defineStoryblokBlocks({ components: {} });
    const container = await AstroContainer.create();

    const result = await container.renderToString(StoryblokBlock, {
      props: { block: { component: "unknown" } },
    });

    expect(result.trim()).toBe("");
  });

  it("renders the fallback when no component resolves", async () => {
    defineStoryblokBlocks({ components: {}, fallback: Fallback });
    const container = await AstroContainer.create();

    const result = await container.renderToString(StoryblokBlock, {
      props: { block: { component: "unknown" } },
    });

    expect(result).toContain("Missing component for unknown");
  });

  it("maps an array of blocks through StoryblokBlock", async () => {
    defineStoryblokBlocks({ components: { teaser: Teaser } });
    const container = await AstroContainer.create();

    const result = await container.renderToString(StoryblokBlocks, {
      props: {
        blocks: [
          { component: "teaser", headline: "First" },
          { component: "teaser", headline: "Second" },
        ],
      },
    });

    expect(result).toContain("First");
    expect(result).toContain("Second");
  });
});
