import { forwardRef } from 'react';
import { useStoryblokRichText } from './richtext';
import type { StoryblokRichtextProps } from './core/richtext-hoc';

const StoryblokRichText = forwardRef<HTMLDivElement, StoryblokRichtextProps>(
  ({ document, optimizeImage, components }, ref) => {
    const html = useStoryblokRichText({ document, optimizeImage, components });
    return (
      <div ref={ref}>
        {html}
      </div>
    );
  },
);

export default StoryblokRichText;
