import type { ComponentType, ReactNode } from "react";
import { createRichTextRenderer } from "./renderer";
import type { StoryblokReactRichTextComponentProps } from "./renderer";
import type { StoryblokBlockData } from "../types";
import { createDefaultBlock } from "./create-default-block";

export function createStoryblokRichText(
  StoryblokComponent: ComponentType<{ block: StoryblokBlockData }>,
) {
  const DefaultBlock = createDefaultBlock(StoryblokComponent);

  return function StoryblokRichText({
    document,
    optimizeImage,
    components,
    data,
  }: StoryblokReactRichTextComponentProps): ReactNode {
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
