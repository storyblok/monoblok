import { describe, expect, it } from "vitest";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import StoryblokPreview from "../src/components/StoryblokPreview.astro";

describe("StoryblokPreview", () => {
  it("renders a <storyblok-preview> custom element instead of a global", async () => {
    const container = await AstroContainer.create();

    const result = await container.renderToString(StoryblokPreview, { props: {} });

    expect(result).toContain("<storyblok-preview");
    // The old implementation stashed props on `window.__storyblokPreviewProps`.
    expect(result).not.toContain("__storyblokPreviewProps");
  });

  it("omits `data-live-update` when `liveUpdate` is not set", async () => {
    const container = await AstroContainer.create();

    const result = await container.renderToString(StoryblokPreview, { props: {} });

    expect(result).not.toContain("data-live-update");
  });

  it("sets `data-live-update` when `liveUpdate` is true", async () => {
    const container = await AstroContainer.create();

    const result = await container.renderToString(StoryblokPreview, {
      props: { liveUpdate: true },
    });

    expect(result).toContain("data-live-update");
  });

  it("carries `debounceMs` and `bridgeOptions` as data attributes", async () => {
    const container = await AstroContainer.create();

    const result = await container.renderToString(StoryblokPreview, {
      props: { debounceMs: 250, bridgeOptions: { resolveRelations: ["a.b"] } },
    });

    expect(result).toContain('data-debounce-ms="250"');
    expect(result).toContain("resolveRelations");
  });

  it("keeps two instances' props independent instead of sharing one global", async () => {
    const container = await AstroContainer.create();

    const first = await container.renderToString(StoryblokPreview, {
      props: { liveUpdate: true },
    });
    const second = await container.renderToString(StoryblokPreview, {
      props: { liveUpdate: false, debounceMs: 999 },
    });

    expect(first).toContain("data-live-update");
    expect(second).not.toContain("data-live-update");
    expect(second).toContain('data-debounce-ms="999"');
  });
});
