import { createRichTextRenderer } from './core/richtext';
import type { StoryblokRichTextProps } from './core/richtext';
import { DefaultBlok } from './storyblok-rich-text';

export const useStoryblokRichText = (props: StoryblokRichTextProps) => {
  const render = createRichTextRenderer({
    optimizeImage: props.optimizeImage,
    components: {
      blok: DefaultBlok,
      ...props.components,
    },
  });

  return render(props.document);
};
