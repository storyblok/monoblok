import React from 'react';
import { StoryblokServerComponent } from './common';
import type { StoryblokRichTextNode, StoryblokRichTextOptions } from '@storyblok/js';
import { BlockTypes, richTextResolver } from '@storyblok/js';

/**
 * RSC-specific component resolver that uses StoryblokServerComponent
 * instead of the client-side StoryblokComponent
 */
export function componentResolver(node: StoryblokRichTextNode<React.ReactElement>): React.ReactElement {
  const body = node?.attrs?.body;
  return React.createElement(StoryblokServerComponent, {
    blok: Array.isArray(body) && body.length > 0 ? body[0] : undefined,
    key: node.attrs?.id || `fallback-key-${JSON.stringify(node.attrs)}`,
  });
}

export function useStoryblokServerRichText(
  options: StoryblokRichTextOptions<React.ReactElement>,
) {
  const mergedOptions = {
    ...options,
    renderFn: React.createElement,
    textFn: (text: string) => React.createElement(React.Fragment, {
      key: Math.random().toString(36).substring(2, 15),
    }, text),
    resolvers: {
      [BlockTypes.COMPONENT]: componentResolver, // ✅ Uses RSC component resolver
      ...options.resolvers,
    },

    keyedResolvers: true,
  };
  return richTextResolver(mergedOptions);
}
