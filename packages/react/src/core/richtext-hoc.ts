import React from 'react';
import type { StoryblokRichTextNode, StoryblokRichTextOptions } from '@storyblok/js';
import { BlockTypes, richTextResolver } from '@storyblok/js';

/**
 * Higher-order component resolver for richtext that uses the provided component
 */
export function createComponentResolver(
  Component: React.ElementType,
  {
    isServerContext = false,
  }: {
    isServerContext?: boolean;
  } = {},
) {
  return function componentResolver(node: StoryblokRichTextNode<React.ReactElement>): React.ReactElement {
    const body = node?.attrs?.body;
    const blok = Array.isArray(body) && body.length > 0 ? body[0] : undefined;
    const key = node.attrs?.id || (isServerContext ? `fallback-key-${JSON.stringify(node.attrs)}` : undefined);

    return React.createElement(Component, {
      blok,
      key,
    });
  };
}

/**
 * Higher-order function that creates a richtext hook with the specified component
 */
export function createRichTextHook(
  Component: React.ElementType,
  {
    isServerContext = false,
  }: {
    isServerContext?: boolean;
  } = {},
) {
  return function useRichText(
    options: StoryblokRichTextOptions<React.ReactElement>,
  ) {
    // Use the same component resolver that's exported
    const componentResolver = createComponentResolver(Component, { isServerContext });

    const mergedOptions = {
      ...(isServerContext ? options : {}),
      renderFn: React.createElement,
      textFn: (text: string) => React.createElement(React.Fragment, {
        key: Math.random().toString(36).substring(2, 15),
      }, text),
      resolvers: {
        [BlockTypes.COMPONENT]: componentResolver,
        ...options.resolvers,
      },
      keyedResolvers: true,
      ...(isServerContext ? {} : options),
    };

    return richTextResolver(mergedOptions);
  };
}
