import { describe, expect, it, vi } from "vitest";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { defineStoryblokBlocks } from "../src/define-storyblok-blocks";
import Teaser from "./block-fixtures/Teaser.astro";
import Fallback from "./block-fixtures/Fallback.astro";
import ExtraPropsEcho from "./block-fixtures/ExtraPropsEcho.astro";
import Blok from "./richtext/Blok.astro";

const documentWith = (...body: Record<string, unknown>[]) => ({
  type: "doc",
  content: [{ type: "blok", attrs: { id: "x", body } }],
});

describe("StoryblokRichText returned by defineStoryblokBlocks", () => {
  it("should render embedded bloks through the registry, with editable attributes", async () => {
    const { StoryblokRichText } = defineStoryblokBlocks(() => ({ components: { teaser: Teaser } }));
    const container = await AstroContainer.create();

    const result = await container.renderToString(StoryblokRichText, {
      props: {
        document: documentWith({
          _uid: "1",
          component: "teaser",
          headline: "Embedded",
          _editable: '<!--#storyblok#{"name": "teaser", "id": "1", "uid": "embedded-uid"}-->',
        }),
      },
    });

    expect(result).toContain('data-test="teaser"');
    expect(result).toContain("Embedded");
    expect(result).toContain("embedded-uid");
  });

  it("should render the registry's fallback for an unregistered embedded blok", async () => {
    const { StoryblokRichText } = defineStoryblokBlocks(() => ({
      components: {},
      fallback: Fallback,
    }));
    const container = await AstroContainer.create();

    const result = await container.renderToString(StoryblokRichText, {
      props: { document: documentWith({ _uid: "1", component: "unknown" }) },
    });

    expect(result).toContain("Missing component for unknown");
  });

  it("should pass a plain-object `data` to embedded blocks as extra props", async () => {
    const { StoryblokRichText } = defineStoryblokBlocks(() => ({
      components: { echo: ExtraPropsEcho },
    }));
    const container = await AstroContainer.create();

    const result = await container.renderToString(StoryblokRichText, {
      props: {
        document: documentWith({ _uid: "1", component: "echo" }),
        data: { locale: "fr", block: "ignored" },
      },
    });

    expect(result).toContain("locale&quot;:&quot;fr");
    // `data.block` can't replace the block itself.
    expect(result).not.toContain("ignored");
  });

  it("should ignore a non-object `data` for embedded blocks", async () => {
    const { StoryblokRichText } = defineStoryblokBlocks(() => ({
      components: { echo: ExtraPropsEcho },
    }));
    const container = await AstroContainer.create();

    const result = await container.renderToString(StoryblokRichText, {
      props: { document: documentWith({ _uid: "1", component: "echo" }), data: ["a"] },
    });

    expect(result).toContain("{}");
  });

  it("should let a caller's `components.blok` replace the registry renderer", async () => {
    const { StoryblokRichText } = defineStoryblokBlocks(() => ({ components: { teaser: Teaser } }));
    const container = await AstroContainer.create();

    const result = await container.renderToString(StoryblokRichText, {
      props: {
        document: documentWith({ _uid: "1", component: "teaser", headline: "Embedded" }),
        components: { blok: Blok },
      },
    });

    expect(result).toContain('data-test="embedded-blok"');
    expect(result).not.toContain('data-test="teaser"');
  });

  it("should warn for an unregistered embedded blok, unless `warnings={false}`", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const container = await AstroContainer.create();
    const document = documentWith({ _uid: "1", component: "unknown" });

    const silent = defineStoryblokBlocks(() => ({ components: {} }));
    await container.renderToString(silent.StoryblokRichText, {
      props: { document, warnings: false },
    });
    expect(warn).not.toHaveBeenCalled();

    const loud = defineStoryblokBlocks(() => ({ components: {} }));
    await container.renderToString(loud.StoryblokRichText, { props: { document } });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"unknown"'));

    warn.mockRestore();
  });
});
