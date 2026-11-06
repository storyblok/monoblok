import { describe, expect, it, vi } from "vitest";
import { flushSync, mount, unmount } from "svelte";
import type { StoryblokRichTextInput } from "@storyblok/richtext";
import StoryblokRichText from "../lib/components/StoryblokRichText.svelte";

// Its own file: the missing-renderer warning prints once per module instance,
// so these tests depend on running in this order, before any other warning.
const document = {
  type: "doc",
  content: [{ type: "blok", attrs: { id: "blok-1", body: [] } }],
} satisfies StoryblokRichTextInput;

describe("StoryblokRichText warnings", () => {
  it("should not warn about a blok node without a renderer when warnings is false", () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const target = window.document.createElement("div");
    const component = mount(StoryblokRichText, {
      target,
      props: { document, warnings: false },
    });
    flushSync();

    expect(consoleWarn).not.toHaveBeenCalled();
    unmount(component);
    consoleWarn.mockRestore();
  });

  it("should still warn by default after an instance set warnings to false", () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const target = window.document.createElement("div");
    const component = mount(StoryblokRichText, { target, props: { document } });
    flushSync();

    expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('"blok" nodes'));
    unmount(component);
    consoleWarn.mockRestore();
  });
});
