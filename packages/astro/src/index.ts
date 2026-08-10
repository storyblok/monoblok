import storyblokIntegration from "./lib/storyblok-integration";

export { getLiveStory, getPayload, useStoryblokApi } from "./lib/helpers";

export { sanitizeJSON } from "./lib/sanitizeJSON";
export type { IntegrationOptions } from "./lib/storyblok-integration";
export { handleStoryblokMessage } from "./live-preview/handleStoryblokMessage";
export * from "./types";
export { isEditorRequest } from "./utils/isEditorRequest";
export {
  buildAstroAttrs,
  isValidAstroComponent,
  type StoryblokAstroRichTextComponentMap,
  type StoryblokAstroRichTextProps,
  type StoryblokAstroRichTextRenderContext,
} from "./utils/richtext-helpers";

// ── Deprecated: Sb* aliases — will be removed in the next major version ───────
export {
  type SbAstroRichTextComponentMap,
  type SbAstroRichTextProps,
  type SbAstroRichTextRenderContext,
} from "./utils/richtext-helpers";
export { toCamelCase } from "./utils/toCamelCase";
export { storyblokIntegration as storyblok };
export { apiPlugin, loadStoryblokBridge, storyblokEditable, storyblokInit } from "@storyblok/js";

export { buildStoryblokImage, renderRichText, splitTableRows } from "@storyblok/richtext";

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
} from "@storyblok/richtext";

// ── Deprecated: Sb* aliases — will be removed in the next major version ───────
export type {
  RenderSpec,
  SbRichTextDoc,
  SbRichTextElement,
  SbRichTextImageOptions,
  SbRichTextInput,
  SbRichTextMark,
  SbRichTextNode,
  SbRichTextProps,
  SbRichTextRenderContext,
  SbRichTextTextNode,
} from "@storyblok/richtext";

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
} from "@storyblok/richtext";
