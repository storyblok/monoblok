import type { ComponentType, ReactNode } from "react";
import { createRichTextRenderer, type StoryblokRichTextRendererOptions } from "./types";
import type { BlockContent } from "../create-registry";
import { createDefaultBlock } from "./create-default-block";

export function createStoryblokRichText(
  StoryblokComponent: ComponentType<{ block: BlockContent }>,
) {
  const DefaultBlock = createDefaultBlock(StoryblokComponent);

  return function StoryblokRichText({
    document,
    optimizeImage,
    components,
    data,
  }: StoryblokRichTextRendererOptions): ReactNode {
    const render = createRichTextRenderer({
      optimizeImage,
      components: {
        blok: DefaultBlock,
        ...components,
      },
      data,
    });

    return render(document);
  };
}
