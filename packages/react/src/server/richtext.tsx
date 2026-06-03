import { createRichTextRenderer } from '../core/richtext';
import type { StoryblokRichTextProps } from '../core/richtext';
import { DefaultBlok } from './server-storyblok-richtext';

export const useStoryblokServerRichText = (props: StoryblokRichTextProps) => {
  const render = createRichTextRenderer({
    optimizeImage: props.optimizeImage,
    components: {
      blok: DefaultBlok,
      ...props.components,
    },
  });

  return render(props.document);
};
