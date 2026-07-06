import { createRichTextRenderer } from '.';
import type { ReactNode } from 'react';
import type { StoryblokRichTextProps } from '../core/richtext';

export function StoryblokRichText({
  document,
  optimizeImage,
  components,
}: StoryblokRichTextProps): ReactNode {
  const render = createRichTextRenderer({
    optimizeImage,
    components,
  });
  const content = render(document);
  return content;
};
