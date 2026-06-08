import { processAttrs, type SbRichTextElement, type SbRichTextElementByType, type SbRichTextImageOptions, type SbRichTextNode, styleToString } from '@storyblok/richtext';
import type { Component, Snippet } from 'svelte';

export interface SbSvelteRichTextRenderContext {
  optimizeImage?: boolean | SbRichTextImageOptions;
  components?: SbSvelteRichTextComponentMap;
}

type AnyComponent = Component<any>;
export type SbSvelteRichTextComponentMap = {
  [k in SbRichTextElement]?: AnyComponent;
};

export type SbSvelteRichTextProps<
  T extends SbRichTextElement,
> =
  SbRichTextElementByType<SbSvelteRichTextRenderContext>[T]
  & {
    children?: Snippet;
  };
export function buildSvelteAttrs(type: SbRichTextElement, attrs: Record<string, unknown>): Record<string, unknown> {
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
