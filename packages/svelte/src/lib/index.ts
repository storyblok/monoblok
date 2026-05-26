export { type SbSvelteComponentMap, type SbSvelteRichTextProps } from './richtext-helpers';
export * from './storyblok';
export { default as StoryblokComponent } from './StoryblokComponent.svelte';
export { default as StoryblokRichText } from './StoryblokRichText.svelte';
export * from './types';

export {
  apiPlugin,
  useStoryblokBridge,
} from '@storyblok/js';

// Re-exporting same exports from @storyblok/richtext
export { buildStoryblokImage, renderRichText, splitTableRows } from '@storyblok/richtext';

export type {
  SbRichTextDoc,
  SbRichTextImageOptions,
  SbRichTextMark,
  SbRichTextNode,
  SbRichTextOptions,
  SbRichTextProps,
} from '@storyblok/richtext';
