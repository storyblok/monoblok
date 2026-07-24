import storyblokIntegration from './lib/storyblok-integration';

export { getLiveStory, getPayload, useStoryblokApi } from './lib/helpers';

export { sanitizeJSON } from './lib/sanitizeJSON';
export type { IntegrationOptions } from './lib/storyblok-integration';
export { handleStoryblokMessage } from './live-preview/handleStoryblokMessage';
export * from './types';
export { isEditorRequest } from './utils/isEditorRequest';
export { buildAstroAttrs, isValidAstroComponent, type SbAstroRichTextComponentMap, type SbAstroRichTextProps, type SbAstroRichTextRenderContext } from './utils/richtext-helpers';
export { toCamelCase } from './utils/toCamelCase';
export { storyblokIntegration as storyblok };
export {
  apiPlugin,
  loadStoryblokBridge,
  storyblokEditable,
  storyblokInit,
} from '@storyblok/js';

export { buildStoryblokImage, renderRichText, splitTableRows } from '@storyblok/richtext';

export type {
  SbRichTextDoc,
  SbRichTextImageOptions,
  SbRichTextMark,
  SbRichTextNode,
  SbRichTextProps,
  SbRichTextRenderContext,
} from '@storyblok/richtext';

// Re-exporting helpers and types from @storyblok/richtext for StoryblokRichText.astro component.
export { attrsToHtmlString, getEmojiText, getInnerMarks, getStaticChildren, groupLinkNodes, isSelfClosing, normalizeNodes, processAttrs, type RenderSpec, resolveTag, type SbRichTextElement, type SbRichTextInput, type SbRichTextTextNode, styleToString } from '@storyblok/richtext';
