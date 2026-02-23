import React from 'react';
import type { StoryblokRichTextOptions } from '@storyblok/js';
import { ComponentBlok, richTextResolver } from '@storyblok/js';

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
    const { tiptapExtensions, ...rest } = options;

    const mergedOptions = {
      ...(isServerContext ? options : {}),
      renderFn: React.createElement,
      textFn: (text: string) => React.createElement(React.Fragment, {
        key: Math.random().toString(36).substring(2, 15),
      }, text),
      keyedResolvers: true,
      ...(isServerContext ? {} : rest),
      tiptapExtensions: {
        blok: ComponentBlok.configure({
          renderComponent: (blok: Record<string, unknown>, id?: string) => {
            const key = id || (isServerContext ? `fallback-key-${JSON.stringify(blok)}` : undefined);
            return React.createElement(Component, {
              blok,
              key,
            });
          },
        }),
        ...tiptapExtensions,
      },
    };

    return richTextResolver(mergedOptions);
  };
}
