import { describe, expect, it, vi } from "vitest";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { defineStoryblokBlocks } from "../src/define-storyblok-blocks";
import Teaser from "./block-fixtures/Teaser.astro";
import Fallback from "./block-fixtures/Fallback.astro";

describe("StoryblokBlock", () => {
  it("renders the component resolved for the block type", async () => {
    const { StoryblokBlock } = defineStoryblokBlocks(() => ({ components: { teaser: Teaser } }));
    const container = await AstroContainer.create();

    const result = await container.renderToString(StoryblokBlock, {
      props: { block: { component: "teaser", headline: "Hello" } },
    });

    expect(result).toContain("Hello");
  });

  it("renders nothing when no component resolves and there is no fallback", async () => {
    const { StoryblokBlock } = defineStoryblokBlocks(() => ({ components: {} }));
    const container = await AstroContainer.create();

    const result = await container.renderToString(StoryblokBlock, {
      props: { block: { component: "unknown" } },
    });

    expect(result.trim()).toBe("");
  });

  it("renders the fallback when no component resolves", async () => {
    const { StoryblokBlock } = defineStoryblokBlocks(() => ({
      components: {},
      fallback: Fallback,
    }));
    const container = await AstroContainer.create();

    const result = await container.renderToString(StoryblokBlock, {
      props: { block: { component: "unknown" } },
    });

    expect(result).toContain("Missing component for unknown");
  });

  it("falls back and warns when the registered component isn't a valid Astro component", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { StoryblokBlock } = defineStoryblokBlocks(() => ({
      // Simulates a plain object slipping into `components` (e.g. block data
      // passed by mistake), which isn't callable and isn't an Astro factory.
      components: { teaser: {} as any },
      fallback: Fallback,
    }));
    const container = await AstroContainer.create();

    const result = await container.renderToString(StoryblokBlock, {
      props: { block: { component: "teaser" } },
    });

    expect(result).toContain("Missing component for teaser");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("isn't a valid Astro component"));
    warn.mockRestore();
  });

  it("falls back and warns when the registered component is a plain function without `isAstroComponentFactory` (e.g. a React component)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    function FakeReactComponent() {
      return "<div>not an astro component</div>";
    }
    const { StoryblokBlock } = defineStoryblokBlocks(() => ({
      components: { teaser: FakeReactComponent as any },
      fallback: Fallback,
    }));
    const container = await AstroContainer.create();

    const result = await container.renderToString(StoryblokBlock, {
      props: { block: { component: "teaser" } },
    });

    expect(result).toContain("Missing component for teaser");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("isn't a valid Astro component"));
    warn.mockRestore();
  });

  it("renders nothing and warns in dev when `block` is undefined", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { StoryblokBlock } = defineStoryblokBlocks(() => ({ components: { teaser: Teaser } }));
    const container = await AstroContainer.create();

    const result = await container.renderToString(StoryblokBlock, {
      props: {},
    });

    expect(result.trim()).toBe("");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("[storyblok]"));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("undefined `block` prop"));
    warn.mockRestore();
  });

  it("does not warn outside dev when `block` is undefined", async () => {
    vi.stubEnv("DEV", false);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { StoryblokBlock } = defineStoryblokBlocks(() => ({ components: { teaser: Teaser } }));
    const container = await AstroContainer.create();

    const result = await container.renderToString(StoryblokBlock, {
      props: {},
    });

    expect(result.trim()).toBe("");
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
    vi.unstubAllEnvs();
  });
});
