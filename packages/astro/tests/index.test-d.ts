import { describe, expectTypeOf, it } from "vitest";
import { defineStoryblokBlocks, StoryblokPreview, StoryblokRichText } from "../src";
import type { StoryblokRichTextComponentProps } from "../src/richtext-helpers";
import type { StoryblokBlockProps, StoryblokPreviewProps } from "../src/types";

// The public components inline their props type so hovers show the real
// props. These checks keep each inlined copy in sync with its named type.
describe("inlined component props", () => {
  it("should match StoryblokPreviewProps on StoryblokPreview", () => {
    expectTypeOf<Parameters<typeof StoryblokPreview>[0]>().toEqualTypeOf<StoryblokPreviewProps>();
  });

  it("should match StoryblokRichTextComponentProps on StoryblokRichText", () => {
    expectTypeOf<
      Parameters<typeof StoryblokRichText>[0]
    >().toEqualTypeOf<StoryblokRichTextComponentProps>();
  });

  it("should match StoryblokBlockProps on the registry-bound StoryblokBlock", () => {
    type ExtraProps = { locale: string };
    const { StoryblokBlock } = defineStoryblokBlocks<ExtraProps>(() => ({}));

    expectTypeOf<Parameters<typeof StoryblokBlock>[0]>().toEqualTypeOf<
      StoryblokBlockProps<ExtraProps>
    >();
  });
});
