import { createDefaultBlok } from '@/core/create-default-blok';
import { createRichTextRenderer } from '../core/richtext';
import type { SbReactRichTextRenderContext } from '../core/richtext';
import StoryblokServerComponent from './server-component';

export const useStoryblokServerRichText = (props: SbReactRichTextRenderContext = {}) => {
  return createRichTextRenderer({
    optimizeImage: props.optimizeImage,
    components: {
      blok: createDefaultBlok(StoryblokServerComponent),
      ...props.components,
    },
  });
};
