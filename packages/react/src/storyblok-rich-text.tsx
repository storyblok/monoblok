import React, { forwardRef } from 'react';

import { convertAttributesInElement } from './utils';
import { useStoryblokRichText } from './richtext';
import type { StoryblokRichTextProps } from './types';

const StoryblokRichText = forwardRef<HTMLDivElement, StoryblokRichTextProps>(
  ({ doc, tiptapExtensions }, ref) => {
    const { render } = useStoryblokRichText({
      tiptapExtensions,
    });

    const html = render(doc);
    const formattedHtml = convertAttributesInElement(html as React.ReactElement);

    return (
      <div ref={ref}>
        {formattedHtml}
      </div>
    );
  },
);

export default StoryblokRichText;
