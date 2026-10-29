import { describe, expect, it, vi } from "vitest";
import { flushSync, mount, unmount } from "svelte";
import { defineStoryblokBlocks } from "../lib/define-storyblok-blocks";
import Teaser from "./blocks/Teaser.svelte";
import Fallback from "./blocks/Fallback.svelte";

describe("defineStoryblokBlocks", () => {
  it("renders the component registered for the block's type", () => {
    const { StoryblokBlock } = defineStoryblokBlocks(() => ({
      components: { teaser: Teaser },
    }));

    const target = document.createElement("div");
    const block = { _uid: "1", component: "teaser", headline: "Hello" };
    const component = mount(StoryblokBlock, { target, props: { block } });
    flushSync();

    expect(target.querySelector('[data-testid="teaser"]')?.textContent).toBe("Hello");
    unmount(component);
  });

  it("renders the fallback when no component is registered for the block's type", () => {
    const { StoryblokBlock } = defineStoryblokBlocks(() => ({
      components: {},
      fallback: Fallback,
    }));

    const target = document.createElement("div");
    const block = { _uid: "1", component: "unregistered" };
    const component = mount(StoryblokBlock, { target, props: { block } });
    flushSync();

    expect(target.querySelector('[data-testid="fallback"]')?.textContent).toBe(
      "unknown: unregistered",
    );
    unmount(component);
  });

  it("renders nothing when no component is registered and there's no fallback", () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { StoryblokBlock } = defineStoryblokBlocks(() => ({ components: {} }));

    const target = document.createElement("div");
    const block = { _uid: "1", component: "unregistered" };
    const component = mount(StoryblokBlock, { target, props: { block } });
    flushSync();

    expect(target.querySelector("[data-testid]")).toBeNull();
    unmount(component);
    consoleWarn.mockRestore();
  });

  it("forwards extra props to the registered component", () => {
    const { StoryblokBlock } = defineStoryblokBlocks<{ name: string }>(() => ({
      components: { teaser: Teaser },
    }));

    const target = document.createElement("div");
    const block = { _uid: "1", component: "teaser", headline: "Hi" };
    const component = mount(StoryblokBlock, { target, props: { block, name: "sidebar" } });
    flushSync();

    expect(target.querySelector('[data-testid="teaser"]')?.getAttribute("data-name")).toBe(
      "sidebar",
    );
    unmount(component);
  });

  it("only calls the factory once across multiple registries sharing its result", () => {
    const factory = vi.fn(() => ({ components: { teaser: Teaser } }));
    const { StoryblokBlock } = defineStoryblokBlocks(factory);

    const target = document.createElement("div");
    const blockA = { _uid: "1", component: "teaser", headline: "A" };
    const blockB = { _uid: "2", component: "teaser", headline: "B" };

    const a = mount(StoryblokBlock, { target, props: { block: blockA } });
    const b = mount(StoryblokBlock, { target, props: { block: blockB } });
    flushSync();

    expect(factory).toHaveBeenCalledTimes(1);
    unmount(a);
    unmount(b);
  });

  it("scopes registries per call so they don't share state", () => {
    const registryA = defineStoryblokBlocks(() => ({ components: { teaser: Teaser } }));
    const registryB = defineStoryblokBlocks(() => ({ components: {} }));

    const target = document.createElement("div");
    const block = { _uid: "1", component: "teaser", headline: "Hi" };
    const component = mount(registryB.StoryblokBlock, { target, props: { block } });
    flushSync();

    expect(target.querySelector('[data-testid="teaser"]')).toBeNull();
    unmount(component);
    expect(registryA).not.toBe(registryB);
  });
});
