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
  return function componentResolver(node: StoryblokRichTextNode<React.ReactElement>): React.ReactElement[] {
    const body = node?.attrs?.body;

    if (!Array.isArray(body) || body.length === 0) {
      return [];
    }

    const key = node.attrs?.id || (isServerContext ? `fallback-key-${JSON.stringify(node.attrs)}` : undefined);

    return body.map((blok, index) =>
      React.createElement(Component, {
        blok,
        key: `${key}-${index}`,
      }),
    );
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

    const { resolvers, ...optionsWithoutResolvers } = options;

    const mergedOptions = {
      ...(isServerContext ? options : {}),
      renderFn: React.createElement,
      textFn: (text: string) => React.createElement(React.Fragment, {
        key: Math.random().toString(36).substring(2, 15),
      }, text),
      resolvers: {
        [BlockTypes.COMPONENT]: componentResolver,
        ...resolvers,
      },
      keyedResolvers: true,
      ...(isServerContext ? {} : optionsWithoutResolvers),
    };

    return richTextResolver(mergedOptions);
  };
}
