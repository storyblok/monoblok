import type { ComponentType } from "react";
import type { StoryblokReactRichTextProps } from "./types";
import type { BlockContent } from "../create-registry";

export function createDefaultBlock(StoryblokComponent: ComponentType<{ block: BlockContent }>) {
  return function DefaultBlock({ attrs }: StoryblokReactRichTextProps<"blok">) {
    if (!Array.isArray(attrs?.body)) {
      return null;
    }

    return attrs.body.map((block, index) => (
      <StoryblokComponent block={block as BlockContent} key={block._uid || index} />
    ));
  };
}
