// @vitest-environment node

import { render } from "svelte/server";
import { describe, expect, it, vi } from "vitest";
import { defineStoryblokBlocks } from "../lib/define-storyblok-blocks";
import Teaser from "./blocks/Teaser.svelte";

describe("defineStoryblokBlocks SSR", () => {
  it("should render a registered block during SSR", () => {
    const { StoryblokBlock } = defineStoryblokBlocks(() => ({
      components: { teaser: Teaser },
    }));

    const { body } = render(StoryblokBlock, {
      props: {
        block: { _uid: "1", component: "teaser", headline: "Server rendered" },
      },
    });

    expect(body).toContain("Server rendered");
  });

  it("should warn about an unregistered block type during SSR", () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { StoryblokBlock } = defineStoryblokBlocks(() => ({ components: {} }));

    const { body } = render(StoryblokBlock, {
      props: { block: { _uid: "1", component: "unregistered" } },
    });

    // `render()` is lazy: reading `body` runs the component.
    expect(body).not.toContain("data-testid");
    expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining("No component registered"));
    consoleWarn.mockRestore();
  });
  it("should warn about an undefined block during SSR", () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { StoryblokBlock } = defineStoryblokBlocks(() => ({ components: {} }));

    const { body } = render(StoryblokBlock, { props: {} });

    // `render()` is lazy: reading `body` runs the component.
    expect(body).not.toContain("data-testid");
    expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining("undefined `block` prop"));
    consoleWarn.mockRestore();
  });

  it("should not warn during SSR when warnings is false", () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { StoryblokBlock } = defineStoryblokBlocks(() => ({ components: {}, warnings: false }));

    const { body } = render(StoryblokBlock, {
      props: { block: { _uid: "1", component: "unregistered" } },
    });

    expect(body).not.toContain("data-testid");
    expect(consoleWarn).not.toHaveBeenCalled();
    consoleWarn.mockRestore();
  });
});
