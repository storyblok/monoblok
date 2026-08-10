export {
  type StoryblokReactRichTextComponent,
  type StoryblokReactRichTextComponentMap,
  type StoryblokReactRichTextComponentProps,
  type StoryblokReactRichTextProps,
  type StoryblokReactRichTextRenderContext,
} from "./rich-text-renderer";

/**
 * @deprecated Use {@link StoryblokReactRichTextComponentProps} instead. Will be removed in the next major version.
 */
export type { StoryblokReactRichTextComponentProps as StoryblokRichTextProps } from "./rich-text-renderer";

// ── Deprecated: Sb* aliases — will be removed in the next major version ───────
export {
  type SbReactRichTextComponentMap,
  type SbReactRichTextProps,
  type SbReactRichTextRenderContext,
} from "./rich-text-renderer";

export { createRichTextRenderer } from "./rich-text-renderer";

export { buildStoryblokImage, renderRichText, splitTableRows } from "@storyblok/richtext";

export type {
  StoryblokRichTextElement,
  StoryblokRichTextImageOptions,
  StoryblokRichTextInput,
  StoryblokRichTextMark,
  StoryblokRichTextMarkWithKey,
  StoryblokRichTextNode,
  StoryblokRichTextNodeWithKey,
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
  SbRichTextRendererMap,
  SbRichTextTextNode,
} from "@storyblok/richtext";

// Re-exporting helpers from @storyblok/richtext for custom component implementations.
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
