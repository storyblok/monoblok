import { createRichTextRenderer } from './core/richtext';
import type { SbReactRichTextRenderContext } from './core/richtext';
import StoryblokComponent from './core/storyblok-component';
import { createDefaultBlok } from './core/create-default-blok';

export const useStoryblokRichText = (props: SbReactRichTextRenderContext = {}) => {
  return createRichTextRenderer({
    optimizeImage: props.optimizeImage,
    components: {
      blok: createDefaultBlok(StoryblokComponent),
      ...props.components,
    },
  });
};
