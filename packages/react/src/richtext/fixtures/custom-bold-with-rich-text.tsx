/**
 * Custom bold-mark component that internally uses StoryblokRichText.
 * Mirrors `heading-with-rich-text.tsx`'s technique, but for a mark rather
 * than a node: without a self-recursion guard on marks, this would recurse
 * without limit (CustomBoldWithRichText -> StoryblokRichText -> bold mark ->
 * CustomBoldWithRichText -> ...).
 */
import type { StoryblokRichTextInput } from "@storyblok/richtext";
import type { StoryblokReactRichTextProps } from "../renderer";
import { defineStoryblokComponents } from "../../define-storyblok-components";

const { StoryblokRichText } = defineStoryblokComponents({ components: {} });

const nestedBoldDocument: StoryblokRichTextInput = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "nested", marks: [{ type: "bold" }] }],
    },
  ],
};

export default function CustomBoldWithRichText({
  children,
  context,
}: StoryblokReactRichTextProps<"bold">) {
  return (
    <strong data-type="recursive-bold">
      {children}
      <StoryblokRichText document={nestedBoldDocument} {...context} />
    </strong>
  );
}
