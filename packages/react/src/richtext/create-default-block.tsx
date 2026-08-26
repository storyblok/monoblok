import type { ComponentType } from "react";
import type { StoryblokReactRichTextProps } from "./renderer";
import type { StoryblokBlockData } from "../types";

export function createDefaultBlock(
  StoryblokComponent: ComponentType<{ block: StoryblokBlockData }>,
) {
  return function DefaultBlock({ attrs }: StoryblokReactRichTextProps<"blok">) {
    if (!Array.isArray(attrs?.body)) {
      return null;
    }

    return attrs.body.map((block) =>
      block._uid ? (
        <StoryblokComponent block={block as StoryblokBlockData} key={block._uid} />
      ) : null,
    );
  };
}
