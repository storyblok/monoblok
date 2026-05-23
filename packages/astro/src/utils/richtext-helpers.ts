import { type BaseSbRichTextProps, processAttrs, type SbRichTextElement, type SbRichTextImageOptions, type SbRichTextRenderers, styleToString } from '@storyblok/richtext';
import type { AstroComponentFactory } from 'astro/runtime/server/render/astro/index.js';

export type SbAstroComponentMap = SbRichTextRenderers<AstroComponentFactory>;
export interface SbAstroRendererOptions {
  optimizeImage?: boolean | SbRichTextImageOptions;
  components?: SbAstroComponentMap;
}
export type SbAstroRichTextProps<T extends SbRichTextElement> =
  BaseSbRichTextProps<T, SbAstroRendererOptions>;

export function isValidAstroComponent(component: unknown): component is AstroComponentFactory {
  return (
    typeof component === 'function'
    || (typeof component === 'object' && component !== null && 'isAstroComponentFactory' in component)
  );
}

export function buildAstroAttrs(type: SbRichTextElement, attrs: Record<string, unknown>): Record<string, unknown> {
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
