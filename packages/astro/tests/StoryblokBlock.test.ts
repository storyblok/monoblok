import { describe, expect, it, vi } from "vitest";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { defineStoryblokBlocks } from "../src/define-storyblok-blocks";
import Teaser from "./block-fixtures/Teaser.astro";
import Fallback from "./block-fixtures/Fallback.astro";

const EDITOR_URL =
  "https://example.com/?_storyblok=123&_storyblok_c=456&_storyblok_tk[space_id]=789";

describe("StoryblokBlock", () => {
  it("should render the component resolved for the block type", async () => {
    const { StoryblokBlock } = defineStoryblokBlocks(() => ({ components: { teaser: Teaser } }));
    const container = await AstroContainer.create();

    const result = await container.renderToString(StoryblokBlock, {
      props: { block: { component: "teaser", headline: "Hello" } },
    });

    expect(result).toContain("Hello");
  });

  it("should render nothing when no component resolves and there is no fallback", async () => {
    const { StoryblokBlock } = defineStoryblokBlocks(() => ({ components: {} }));
    const container = await AstroContainer.create();

    const result = await container.renderToString(StoryblokBlock, {
      props: { block: { component: "unknown" } },
    });

    expect(result.trim()).toBe("");
  });

  it("should render the fallback when no component resolves", async () => {
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

  it("should fall back and warn when the registered component isn't a valid Astro component", async () => {
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

  it("should fall back and warn when the registered component is a plain function without `isAstroComponentFactory` (e.g. a React component)", async () => {
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

  it("should render nothing and warn when `fallback` isn't a valid Astro component", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    function FakeReactComponent() {
      return "<div>not an astro component</div>";
    }
    const { StoryblokBlock } = defineStoryblokBlocks(() => ({
      components: {},
      fallback: FakeReactComponent as any,
    }));
    const container = await AstroContainer.create();

    const result = await container.renderToString(StoryblokBlock, {
      props: { block: { component: "unknown" } },
    });

    expect(result.trim()).toBe("");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("`fallback`"));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("isn't a valid Astro component"));
    warn.mockRestore();
  });

  it("should render nothing and warn in dev when `block` is undefined", async () => {
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

  it("should warn outside dev too when `block` is undefined", async () => {
    vi.stubEnv("DEV", false);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { StoryblokBlock } = defineStoryblokBlocks(() => ({ components: { teaser: Teaser } }));
    const container = await AstroContainer.create();

    await container.renderToString(StoryblokBlock, { props: {} });

    expect(warn).toHaveBeenCalledWith(expect.stringContaining("undefined `block` prop"));
    warn.mockRestore();
    vi.unstubAllEnvs();
  });

  it("should not warn about an undefined `block` inside the Visual Editor", async () => {
    // The Visual Editor's visual history sends a story without `content`.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { StoryblokBlock } = defineStoryblokBlocks(() => ({ components: { teaser: Teaser } }));
    const container = await AstroContainer.create();

    const result = await container.renderToString(StoryblokBlock, {
      props: {},
      request: new Request(EDITOR_URL),
    });

    expect(result.trim()).toBe("");
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("should warn only once per registry and block type", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { StoryblokBlock } = defineStoryblokBlocks(() => ({ components: {} }));
    const container = await AstroContainer.create();

    await container.renderToString(StoryblokBlock, { props: { block: { component: "a" } } });
    await container.renderToString(StoryblokBlock, { props: { block: { component: "a" } } });
    await container.renderToString(StoryblokBlock, { props: { block: { component: "b" } } });

    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenNthCalledWith(1, expect.stringContaining('"a"'));
    expect(warn).toHaveBeenNthCalledWith(2, expect.stringContaining('"b"'));
    warn.mockRestore();
  });

  it("should not warn with `warnings: false`", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { StoryblokBlock } = defineStoryblokBlocks(() => ({
      components: { teaser: {} as any },
      fallback: (() => "") as any,
      warnings: false,
    }));
    const container = await AstroContainer.create();

    await container.renderToString(StoryblokBlock, { props: {} });
    await container.renderToString(StoryblokBlock, { props: { block: { component: "teaser" } } });
    await container.renderToString(StoryblokBlock, { props: { block: { component: "unknown" } } });

    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("should not resolve a block type named after an `Object.prototype` member", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { StoryblokBlock } = defineStoryblokBlocks(() => ({
      components: {},
      fallback: Fallback,
    }));
    const container = await AstroContainer.create();

    const result = await container.renderToString(StoryblokBlock, {
      props: { block: { component: "constructor" } },
    });

    expect(result).toContain("Missing component for constructor");
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("should not let an extra prop replace the injected `block` or `editable`", async () => {
    const { StoryblokBlock } = defineStoryblokBlocks(() => ({
      components: { teaser: Teaser },
    }));
    const container = await AstroContainer.create();

    const result = await container.renderToString(StoryblokBlock, {
      props: {
        block: {
          component: "teaser",
          headline: "Real",
          _editable: '<!--#storyblok#{"name": "teaser", "id": "1", "uid": "real-uid"}-->',
        },
        editable: { "data-blok-uid": "fake-uid" },
      },
    });

    expect(result).toContain("Real");
    expect(result).toContain("real-uid");
    expect(result).not.toContain("fake-uid");
  });
});
