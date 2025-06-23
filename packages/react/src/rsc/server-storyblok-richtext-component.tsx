import React, { forwardRef } from 'react';

import { convertAttributesInElement } from '../utils';
import type { StoryblokRichTextProps } from '../types';
import { useStoryblokServerRichText } from './richtext';

const StoryblokRichText = forwardRef<HTMLDivElement, StoryblokRichTextProps>(
  ({ doc, resolvers }, ref) => {
    if (!doc) {
      return null;
    }
    const { render } = useStoryblokServerRichText({
      resolvers,
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
