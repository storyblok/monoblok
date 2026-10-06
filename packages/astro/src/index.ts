export { defineStoryblokBlocks } from './define-storyblok-blocks';
// Re-exported so `resolveBlockComponent` stays reachable for the .astro bundler graph.
export { resolveBlockComponent } from './registry';
export { liveEditMiddleware } from './live-preview/middleware';
export { getPayload } from './lib/helpers';
export { default as StoryblokLivePreview } from './components/StoryblokLivePreview.astro';
export { default as StoryblokServerData } from './components/StoryblokServerData.astro';
export { default as StoryblokRichText } from './components/StoryblokRichText.astro';
export { storyblokEditable, isInEditor } from '@storyblok/live-preview';
export { sanitizeJSON } from './lib/sanitizeJSON';

export type {
  DefineStoryblokBlocksOptions,
  StoryblokBlockComponentProps,
  StoryblokBlockData,
  StoryblokBlockComponent,
  StoryblokComponentMap,
  StoryblokEditableProps,
} from './types';

export {
  buildAstroAttrs,
  isValidAstroComponent,
  type StoryblokAstroRichTextComponentMap,
  type StoryblokAstroRichTextProps,
  type StoryblokAstroRichTextRenderContext,
} from './utils/richtext-helpers';

export {
  buildStoryblokImage,
  renderRichText,
  splitTableRows,
} from '@storyblok/richtext';

export type {
  StoryblokRichTextElement,
  StoryblokRichTextImageOptions,
  StoryblokRichTextInput,
  StoryblokRichTextMark,
  StoryblokRichTextNode,
  StoryblokRichTextProps,
  StoryblokRichTextRenderContext,
  StoryblokRichTextRenderSpec,
  StoryblokRichTextTextNode,
} from '@storyblok/richtext';

// Re-exporting helpers and types from @storyblok/richtext for StoryblokRichText.astro component.
export {
  attrsToHtmlString,
  getInnerMarks,
  getStaticChildren,
  groupLinkNodes,
  hasContent,
  isSelfClosing,
  normalizeNodes,
  processAttrs,
  resolveTag,
  styleToString,
} from '@storyblok/richtext';
