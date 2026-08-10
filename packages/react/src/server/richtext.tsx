import { createDefaultBlok } from "@/core/create-default-blok";
import { createRichTextRenderer } from "../core/richtext";
import type { StoryblokReactRichTextRenderContext } from "../core/richtext";
import StoryblokServerComponent from "./server-component";

export const useStoryblokServerRichText = (props: StoryblokReactRichTextRenderContext = {}) => {
  return createRichTextRenderer({
    optimizeImage: props.optimizeImage,
    components: {
      blok: createDefaultBlok(StoryblokServerComponent),
      ...props.components,
    },
  });
};
