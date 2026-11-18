import type { StoryblokReactRichTextProps } from "@storyblok/react";
import { StoryblokBlock } from "../storyblok";

/** Renders bloks embedded in rich text through the app's block registry. */
export default function RichTextBlok({ attrs }: StoryblokReactRichTextProps<"blok">) {
  return attrs.body?.map((block, index) => (
    <StoryblokBlock key={block._uid ?? index} block={block} />
  ));
}
