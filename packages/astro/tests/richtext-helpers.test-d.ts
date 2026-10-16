import { describe, it } from "vitest";
import type { StoryblokRichTextComponentProps } from "../src/richtext-helpers";

describe("StoryblokRichTextComponentProps['optimizeImage'] typing", () => {
  it("accepts a partial options object, matching @storyblok/richtext's own `optimizeImage`", () => {
    // All fields on `StoryblokRichTextImageOptions` are required, but callers
    // (and the JSDoc example in `index.ts`) only ever pass a subset, e.g.
    // `optimizeImage={{ width: 800 }}`. `@storyblok/richtext` itself types
    // this option as `Partial<StoryblokRichTextImageOptions>` for the same
    // reason.
    const _widthOnly: StoryblokRichTextComponentProps["optimizeImage"] = { width: 800 };
    const _enabled: StoryblokRichTextComponentProps["optimizeImage"] = true;
    const _disabled: StoryblokRichTextComponentProps["optimizeImage"] = false;
    const _undefined: StoryblokRichTextComponentProps["optimizeImage"] = undefined;

    void _widthOnly;
    void _enabled;
    void _disabled;
    void _undefined;
  });
});
