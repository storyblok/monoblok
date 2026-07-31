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

/**
 * @deprecated Use {@link StoryblokAstroRichTextComponentMap} instead. Will be removed in the next major version.
 */
export type SbAstroRichTextComponentMap = StoryblokAstroRichTextComponentMap;

export interface StoryblokAstroRichTextRenderContext {
  optimizeImage?: boolean | StoryblokRichTextImageOptions;
  components?: StoryblokAstroRichTextComponentMap;
  data?: unknown;
}
/**
 * @deprecated Use {@link StoryblokAstroRichTextRenderContext} instead. Will be removed in the next major version.
 */
export type SbAstroRichTextRenderContext = StoryblokAstroRichTextRenderContext;

export type StoryblokAstroRichTextProps<T extends StoryblokRichTextElement> =
  Omit<StoryblokRichTextProps<T>, 'context'> & {
    context?: StoryblokAstroRichTextRenderContext;
  };
/**
 * @deprecated Use {@link StoryblokAstroRichTextProps} instead. Will be removed in the next major version.
 */
export type SbAstroRichTextProps<T extends StoryblokRichTextElement> =
  StoryblokAstroRichTextProps<T>;

export function isValidAstroComponent(
  component: unknown,
): component is AstroComponentFactory {
  return (
    typeof component === 'function'
    || (typeof component === 'object'
      && component !== null
      && 'isAstroComponentFactory' in component)
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
