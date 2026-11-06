import { describe, expect, it, vi } from "vitest";
import { flushSync, mount, unmount } from "svelte";
import type { StoryblokRichTextInput } from "@storyblok/richtext";
import { defineStoryblokBlocks } from "../lib/define-storyblok-blocks";
import Teaser from "./blocks/Teaser.svelte";
import RequiresLocale from "./blocks/RequiresLocale.svelte";
import Blok from "./richtext/Blok.svelte";
import RichTextHost from "./richtext/RichTextHost.svelte";

const documentWithBlok = {
  type: "doc",
  content: [
    {
      type: "blok",
      attrs: {
        id: "blok-1",
        body: [
          {
            _uid: "uid-1",
            component: "teaser",
            headline: "Embedded teaser",
            _editable:
              '<!--#storyblok#{"name": "teaser", "space": "1", "uid": "uid-1", "id": "1"}-->',
          },
        ],
      },
    },
  ],
} satisfies StoryblokRichTextInput;

describe("defineStoryblokBlocks StoryblokRichText", () => {
  // First in the file: the missing-renderer warning prints once per module
  // instance, so a later position could pass without the default renderer.
  it("should not warn about embedded blocks without a components.blok renderer", () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { StoryblokRichText } = defineStoryblokBlocks(() => ({ components: { teaser: Teaser } }));
    const target = document.createElement("div");
    const component = mount(StoryblokRichText, { target, props: { document: documentWithBlok } });
    flushSync();

    expect(consoleWarn).not.toHaveBeenCalled();
    unmount(component);
    consoleWarn.mockRestore();
  });

  it("should render embedded blocks through the registry", () => {
    const { StoryblokRichText } = defineStoryblokBlocks(() => ({ components: { teaser: Teaser } }));
    const target = document.createElement("div");
    const component = mount(StoryblokRichText, { target, props: { document: documentWithBlok } });
    flushSync();

    const teaser = target.querySelector('[data-testid="teaser"]');
    expect(teaser?.textContent).toBe("Embedded teaser");
    expect(teaser?.getAttribute("data-blok-uid")).toBe("1-uid-1");
    unmount(component);
  });

  it("should use a components.blok renderer passed by the caller instead", () => {
    const { StoryblokRichText } = defineStoryblokBlocks(() => ({ components: { teaser: Teaser } }));
    const target = document.createElement("div");
    const component = mount(StoryblokRichText, {
      target,
      props: { document: documentWithBlok, components: { blok: Blok } },
    });
    flushSync();

    expect(target.querySelector('[data-testid="embedded-block"]')).not.toBeNull();
    expect(target.querySelector('[data-testid="teaser"]')).toBeNull();
    unmount(component);
  });

  it("should pass a plain-object data to embedded blocks as extra props", () => {
    const { StoryblokRichText } = defineStoryblokBlocks<{ locale: string }>(() => ({
      components: { teaser: RequiresLocale },
    }));
    const target = document.createElement("div");
    const component = mount(StoryblokRichText, {
      target,
      props: { document: documentWithBlok, data: { locale: "fr" } },
    });
    flushSync();

    expect(target.querySelector("[data-locale]")?.getAttribute("data-locale")).toBe("fr");
    unmount(component);
  });

  it("should rerender embedded blocks when the document changes", () => {
    const { StoryblokRichText } = defineStoryblokBlocks(() => ({ components: { teaser: Teaser } }));
    const target = document.createElement("div");
    const host = mount(RichTextHost, {
      target,
      props: { StoryblokRichText, document: documentWithBlok },
    });
    flushSync();

    const [blokNode] = documentWithBlok.content;
    host.update({
      ...documentWithBlok,
      content: [
        {
          ...blokNode,
          attrs: {
            ...blokNode.attrs,
            body: [{ ...blokNode.attrs.body[0], headline: "Updated teaser" }],
          },
        },
      ],
    });
    flushSync();

    expect(target.querySelector('[data-testid="teaser"]')?.textContent).toBe("Updated teaser");
    unmount(host);
  });

  it("should warn about an unregistered embedded block type", () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { StoryblokRichText } = defineStoryblokBlocks(() => ({ components: {} }));
    const target = document.createElement("div");
    const component = mount(StoryblokRichText, { target, props: { document: documentWithBlok } });
    flushSync();

    expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('"teaser"'));
    unmount(component);
    consoleWarn.mockRestore();
  });

  it("should not warn about an unregistered embedded block type when warnings is false", () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { StoryblokRichText } = defineStoryblokBlocks(() => ({ components: {} }));
    const target = document.createElement("div");
    const component = mount(StoryblokRichText, {
      target,
      props: { document: documentWithBlok, warnings: false },
    });
    flushSync();

    expect(consoleWarn).not.toHaveBeenCalled();
    unmount(component);
    consoleWarn.mockRestore();
  });

  it("should not let data replace the editable attributes of embedded blocks", () => {
    const { StoryblokRichText } = defineStoryblokBlocks(() => ({ components: { teaser: Teaser } }));
    const target = document.createElement("div");
    const component = mount(StoryblokRichText, {
      target,
      props: {
        document: documentWithBlok,
        data: { editable: { "data-blok-uid": "replaced" } },
      },
    });
    flushSync();

    const teaser = target.querySelector('[data-testid="teaser"]');
    expect(teaser?.getAttribute("data-blok-uid")).toBe("1-uid-1");
    unmount(component);
  });
});
