import {
  processAttrs,
  type StoryblokRichTextElement,
  type StoryblokRichTextImageOptions,
  type StoryblokRichTextProps,
  styleToString,
} from '@storyblok/richtext';
import type { AstroComponentFactory } from 'astro/runtime/server/render/astro/index.js';

export type StoryblokAstroRichTextComponentMap = {
  [K in StoryblokRichTextElement]?: AstroComponentFactory;
};

export interface StoryblokAstroRichTextRenderContext {
  optimizeImage?: boolean | StoryblokRichTextImageOptions;
  components?: StoryblokAstroRichTextComponentMap;
  data?: unknown;
}

export type StoryblokAstroRichTextProps<T extends StoryblokRichTextElement> =
  Omit<StoryblokRichTextProps<T>, 'context' | 'children'> & {
    context?: StoryblokAstroRichTextRenderContext;
  };

export function isValidAstroComponent(
  component: unknown,
): component is AstroComponentFactory {
  return (
    typeof component === 'function' ||
    (typeof component === 'object' &&
      component !== null &&
      'isAstroComponentFactory' in component)
  );
}

export function buildAstroAttrs(
  type: StoryblokRichTextElement,
  attrs: Record<string, unknown>,
): Record<string, unknown> {
  const processedAttrs = processAttrs(type, attrs, {
    colspan: 'colspan',
    rowspan: 'rowspan',
  });

  const styleObj = processedAttrs?.style as Record<string, unknown> | undefined;
  const finalAttrs: Record<string, unknown> = { ...processedAttrs };

  if (styleObj) {
    finalAttrs.style = styleToString(styleObj);
  }

  return finalAttrs;
}
