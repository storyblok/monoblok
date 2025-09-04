import React, { useMemo } from 'react';
import { richTextResolver } from '@storyblok/richtext';
import type {
  StoryblokRichTextNode,
  StoryblokRichTextOptions,
} from '@storyblok/richtext';
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
    return richTextResolver(options).render(content);
  }, [content, options]);
};

// Component for rendering rich text
export const StoryblokRichText: React.FC<StoryblokRichTextProps> = ({
  doc,
  resolvers,
}) => {
  const renderedContent = richTextResolver({ resolvers }).render(doc);

  if (!renderedContent) {
    return null;
  }

  return <div dangerouslySetInnerHTML={{ __html: renderedContent }} />;
};

// Default export for backward compatibility
export default StoryblokRichText;
