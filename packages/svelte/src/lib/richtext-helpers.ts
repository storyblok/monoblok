import { type BaseSbRichTextProps, processAttrs, type SbRichTextElement, type SbRichTextImageOptions, type SbRichTextNode, styleToString } from '@storyblok/richtext';
import type { Component, Snippet } from 'svelte';

export type SbRichTextInput = SbRichTextNode | SbRichTextNode[] | null | undefined;
export interface SbSvelteRendererOptions {
  optimizeImage?: boolean | SbRichTextImageOptions;
  components?: SbSvelteComponentMap;
}

type AnyComponent = Component<any>;
export type SbSvelteComponentMap = {
  [k in SbRichTextElement]?: AnyComponent;
};
export type SbSvelteRichTextProps<T extends SbRichTextElement> =
  BaseSbRichTextProps<T, { children?: Snippet; components?: SbSvelteComponentMap }, { children?: Snippet }>;

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
