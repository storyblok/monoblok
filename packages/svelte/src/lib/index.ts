import { type SbRichTextDoc, type SbRichTextElement, styleToString } from '@storyblok/richtext';
import type { Component } from 'svelte';

export * from './storyblok';
export { default as StoryblokComponent } from './StoryblokComponent.svelte';
export { default as StoryblokRichText } from './StoryblokRichText.svelte';
export * from './types';
export {
  apiPlugin,
  useStoryblokBridge,
} from '@storyblok/js';

export type { BaseSbRichTextProps, PMMark, SbRichTextDoc, SbRichTextElement, SbRichTextOptions, SbRichTextProps, SbRichTextTextNode } from '@storyblok/richtext';
export { buildStoryblokImage, isSelfClosing, processAttrs, renderRichText, resolveTag } from '@storyblok/richtext';
export type SbRichTextInput = SbRichTextDoc | SbRichTextDoc[] | null | undefined;
  type AnyComponent = Component<any>;
export type SbRichTextRenderers = {
  [k in SbRichTextElement]?: AnyComponent;
};

export function buildSvelteAttrs(attrs: Record<string, unknown>): Record<string, unknown> {
  const styleObj = attrs?.style as Record<string, unknown> | undefined;
  const finalAttrs: Record<string, unknown> = { ...attrs };

  if (styleObj) {
    finalAttrs.style = styleToString(styleObj);
  }
  return finalAttrs;
}
