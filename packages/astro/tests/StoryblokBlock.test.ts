import { describe, expect, it } from "vitest";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { defineStoryblokBlocks } from "../src/define-storyblok-blocks";
import Teaser from "./block-fixtures/Teaser.astro";
import Fallback from "./block-fixtures/Fallback.astro";

describe("StoryblokBlock", () => {
  it("renders the component resolved for the block type", async () => {
    const { StoryblokBlock } = defineStoryblokBlocks({ components: { teaser: Teaser } });
    const container = await AstroContainer.create();

    const result = await container.renderToString(StoryblokBlock, {
      props: { block: { component: "teaser", headline: "Hello" } },
    });

    expect(result).toContain("Hello");
  });

  it("renders nothing when no component resolves and there is no fallback", async () => {
    const { StoryblokBlock } = defineStoryblokBlocks({ components: {} });
    const container = await AstroContainer.create();

    const result = await container.renderToString(StoryblokBlock, {
      props: { block: { component: "unknown" } },
    });

    expect(result.trim()).toBe("");
  });

  it("renders the fallback when no component resolves", async () => {
    const { StoryblokBlock } = defineStoryblokBlocks({ components: {}, fallback: Fallback });
    const container = await AstroContainer.create();

    const result = await container.renderToString(StoryblokBlock, {
      props: { block: { component: "unknown" } },
    });

    expect(result).toContain("Missing component for unknown");
  });
});
