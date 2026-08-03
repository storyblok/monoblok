import { createRichTextRenderer } from './core/richtext';
import type { StoryblokReactRichTextRenderContext } from './core/richtext';
import StoryblokComponent from './core/storyblok-component';
import { createDefaultBlok } from './core/create-default-blok';

export const useStoryblokRichText = (props: StoryblokReactRichTextRenderContext = {}) => {
  return createRichTextRenderer({
    optimizeImage: props.optimizeImage,
    components: {
      blok: createDefaultBlok(StoryblokComponent),
      ...props.components,
    },
  });
};
