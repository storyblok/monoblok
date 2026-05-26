import storyblokIntegration from './lib/storyblok-integration';

export { getLiveStory, getPayload, useStoryblokApi } from './lib/helpers';

export { sanitizeJSON } from './lib/sanitizeJSON';
export type { IntegrationOptions } from './lib/storyblok-integration';
export { handleStoryblokMessage } from './live-preview/handleStoryblokMessage';
export * from './types';
export { isEditorRequest } from './utils/isEditorRequest';
export { buildAstroAttrs, isValidAstroComponent, type SbAstroComponentMap, type SbAstroRendererOptions, type SbAstroRichTextProps } from './utils/richtext-helpers';
export { toCamelCase } from './utils/toCamelCase';
export { storyblokIntegration as storyblok };
export {
  apiPlugin,
  loadStoryblokBridge,
  storyblokEditable,
  storyblokInit,
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

// Re-exporting helpers and types from @storyblok/richtext for StoryblokRichText.astro component.
export { attrsToHtmlString, getInnerMarks, getStaticChildren, groupLinkNodes, isSelfClosing, normalizeNodes, processAttrs, type RenderSpec, resolveTag, type SbRichTextElement, type SbRichTextTextNode, styleToString } from '@storyblok/richtext';
