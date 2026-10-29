import { describe, expect, it, vi } from "vitest";
import { flushSync, mount, unmount } from "svelte";
import { defineStoryblokBlocks } from "../lib/define-storyblok-blocks";
import Teaser from "./blocks/Teaser.svelte";
import Fallback from "./blocks/Fallback.svelte";
import BlockHost from "./blocks/BlockHost.svelte";

describe("defineStoryblokBlocks", () => {
  it("should render the component registered for the block's type", () => {
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

  it("should render the fallback when no component is registered for the block's type", () => {
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

  it("should warn and render nothing when no component is registered and there's no fallback", () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { StoryblokBlock } = defineStoryblokBlocks(() => ({ components: {} }));

    const target = document.createElement("div");
    const block = { _uid: "1", component: "unregistered" };
    const component = mount(StoryblokBlock, { target, props: { block } });
    flushSync();

    expect(target.querySelector("[data-testid]")).toBeNull();
    expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining("No component registered"));
    unmount(component);
    consoleWarn.mockRestore();
  });

  it("should forward extra props without colliding with registry props", () => {
    const { StoryblokBlock } = defineStoryblokBlocks<{
      components: string;
      fallback: string;
      name: string;
    }>(() => ({
      components: { teaser: Teaser },
    }));

    const target = document.createElement("div");
    const block = { _uid: "1", component: "teaser", headline: "Hi" };
    const component = mount(StoryblokBlock, {
      target,
      props: { block, name: "sidebar", components: "custom", fallback: "fallback" },
    });
    flushSync();

    expect(target.querySelector('[data-testid="teaser"]')?.getAttribute("data-name")).toBe(
      "sidebar",
    );
    expect(target.querySelector('[data-testid="teaser"]')?.getAttribute("data-components")).toBe(
      "custom",
    );
    expect(target.querySelector('[data-testid="teaser"]')?.getAttribute("data-fallback")).toBe(
      "fallback",
    );
    unmount(component);
  });

  it("should only call the factory once across multiple component instances", () => {
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

  it("should scope registries per call so they don't share state", () => {
    const registryA = defineStoryblokBlocks(() => ({ components: { teaser: Teaser } }));
    const registryB = defineStoryblokBlocks(() => ({ components: {} }));

    const targetA = document.createElement("div");
    const targetB = document.createElement("div");
    const block = { _uid: "1", component: "teaser", headline: "Hi" };
    const componentA = mount(registryA.StoryblokBlock, { target: targetA, props: { block } });
    const componentB = mount(registryB.StoryblokBlock, { target: targetB, props: { block } });
    flushSync();

    expect(targetA.querySelector('[data-testid="teaser"]')).not.toBeNull();
    expect(targetB.querySelector('[data-testid="teaser"]')).toBeNull();
    unmount(componentA);
    unmount(componentB);
  });

  it("should inject editable attributes into the registered component", () => {
    const { StoryblokBlock } = defineStoryblokBlocks(() => ({ components: { teaser: Teaser } }));
    const target = document.createElement("div");
    const block = {
      _uid: "uid-1",
      _editable: '<!--#storyblok#{"id":"story-1","uid":"uid-1"}-->',
      component: "teaser",
      headline: "Hello",
    };
    const component = mount(StoryblokBlock, { target, props: { block } });
    flushSync();

    expect(target.querySelector('[data-testid="teaser"]')?.getAttribute("data-blok-uid")).toBe(
      "story-1-uid-1",
    );
    unmount(component);
  });

  it("should warn when the block prop is undefined", () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { StoryblokBlock } = defineStoryblokBlocks(() => ({ components: { teaser: Teaser } }));
    const target = document.createElement("div");
    const component = mount(StoryblokBlock, { target, props: {} });
    flushSync();

    expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining("undefined `block` prop"));
    unmount(component);
    consoleWarn.mockRestore();
  });

  it("should update the rendered component when the block changes", () => {
    const { StoryblokBlock } = defineStoryblokBlocks(() => ({ components: { teaser: Teaser } }));
    const target = document.createElement("div");
    const host = mount(BlockHost, {
      target,
      props: {
        StoryblokBlock,
        block: { _uid: "1", component: "teaser", headline: "Before" },
      },
    });
    flushSync();
    expect(target.textContent).toContain("Before");

    host.update({ _uid: "2", component: "teaser", headline: "After" });
    flushSync();
    expect(target.textContent).toContain("After");
    unmount(host);
  });
});
