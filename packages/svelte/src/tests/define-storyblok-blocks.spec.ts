import { describe, expect, it, vi } from "vitest";
import { flushSync, mount, unmount } from "svelte";
import { defineStoryblokBlocks } from "../lib/define-storyblok-blocks";
import Teaser from "./blocks/Teaser.svelte";
import Fallback from "./blocks/Fallback.svelte";
import BlockHost from "./blocks/BlockHost.svelte";
import { StoryblokBlock as CyclicStoryblokBlock } from "./blocks/cycle/registry";

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

  it.each(["constructor", "toString", "hasOwnProperty", "__proto__"])(
    "should render the fallback for a block type named %s",
    (name) => {
      const { StoryblokBlock } = defineStoryblokBlocks(() => ({
        components: { teaser: Teaser },
        fallback: Fallback,
      }));

      const target = document.createElement("div");
      const component = mount(StoryblokBlock, {
        target,
        props: { block: { _uid: "1", component: name } },
      });
      flushSync();

      expect(target.querySelector('[data-testid="fallback"]')?.textContent).toBe(
        `unknown: ${name}`,
      );
      unmount(component);
    },
  );

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

  it("should not warn about an undefined block in the Visual Editor (visual history)", () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const originalUrl = window.location.href;
    window.history.replaceState(
      null,
      "",
      "/?_storyblok=1&_storyblok_c=page&_storyblok_tk[space_id]=123",
    );
    const { StoryblokBlock } = defineStoryblokBlocks(() => ({ components: { teaser: Teaser } }));
    const target = document.createElement("div");
    const component = mount(StoryblokBlock, { target, props: {} });
    flushSync();

    expect(consoleWarn).not.toHaveBeenCalled();
    unmount(component);
    window.history.replaceState(null, "", originalUrl);
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

  // Vitest compiles without HMR, so this passes even with an eager registry.
  // The import-cycle crash only reproduces under `vite dev`; the e2e
  // `/import-cycle` route is the regression guard.
  it("should render nested blocks when a block component imports StoryblokBlock from its registry", () => {
    const target = document.createElement("div");
    const block = {
      _uid: "1",
      component: "branch",
      body: [{ _uid: "2", component: "leaf", text: "Nested" }],
    };
    const component = mount(CyclicStoryblokBlock, { target, props: { block } });
    flushSync();

    expect(target.querySelector('[data-testid="branch"] [data-testid="leaf"]')?.textContent).toBe(
      "Nested",
    );
    unmount(component);
  });

  it("should warn only once per unregistered block type across updates", () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { StoryblokBlock } = defineStoryblokBlocks(() => ({ components: {} }));
    const target = document.createElement("div");
    const host = mount(BlockHost, {
      target,
      props: { StoryblokBlock, block: { _uid: "1", component: "unregistered" } },
    });
    flushSync();
    host.update({ _uid: "1", component: "unregistered", headline: "changed" });
    flushSync();
    const other = mount(StoryblokBlock, {
      target,
      props: { block: { _uid: "2", component: "unregistered" } },
    });
    flushSync();

    expect(consoleWarn).toHaveBeenCalledTimes(1);
    unmount(host);
    unmount(other);
    consoleWarn.mockRestore();
  });

  it("should not warn about an unregistered block type when warnings is false", () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { StoryblokBlock } = defineStoryblokBlocks(() => ({ components: {}, warnings: false }));
    const target = document.createElement("div");
    const component = mount(StoryblokBlock, {
      target,
      props: { block: { _uid: "1", component: "unregistered" } },
    });
    flushSync();

    expect(target.innerHTML).not.toContain("data-testid");
    expect(consoleWarn).not.toHaveBeenCalled();
    unmount(component);
    consoleWarn.mockRestore();
  });

  it("should not warn about an undefined block when warnings is false", () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { StoryblokBlock } = defineStoryblokBlocks(() => ({
      components: { teaser: Teaser },
      warnings: false,
    }));
    const target = document.createElement("div");
    const component = mount(StoryblokBlock, { target, props: {} });
    flushSync();

    expect(consoleWarn).not.toHaveBeenCalled();
    unmount(component);
    consoleWarn.mockRestore();
  });

  it("should keep warning in other registries when one sets warnings to false", () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const silent = defineStoryblokBlocks(() => ({ components: {}, warnings: false }));
    const loud = defineStoryblokBlocks(() => ({ components: {} }));
    const target = document.createElement("div");
    const block = { _uid: "1", component: "unregistered" };
    const first = mount(silent.StoryblokBlock, { target, props: { block } });
    const second = mount(loud.StoryblokBlock, { target, props: { block } });
    flushSync();

    expect(consoleWarn).toHaveBeenCalledTimes(1);
    unmount(first);
    unmount(second);
    consoleWarn.mockRestore();
  });
});
