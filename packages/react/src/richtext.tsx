import React, { useMemo } from 'react';
import { renderRichText } from '@storyblok/js';
import type { StoryblokRichTextNode, StoryblokRichTextOptions } from '@storyblok/js';
import type { StoryblokRichTextProps } from './types';

// Hook for rendering rich text
export const useStoryblokRichText = (
  content: StoryblokRichTextNode,
  options?: StoryblokRichTextOptions,
) => {
  return useMemo(() => {
    if (!content) {
      return null;
    }
    return renderRichText(content, options);
  }, [content, options]);
};

// Component for rendering rich text
export const StoryblokRichText: React.FC<StoryblokRichTextProps> = ({ doc, resolvers }) => {
  const renderedContent = renderRichText(doc, { resolvers });

  if (!renderedContent) {
    return null;
  }

  return <div>{renderedContent}</div>;
};

// Default export for backward compatibility
export default StoryblokRichText;
