export {
  type StoryblokSvelteRichTextComponentMap,
  type StoryblokSvelteRichTextProps,
  type StoryblokSvelteRichTextRenderContext,
} from "./richtext-helpers";

export { default as StoryblokRichText } from "./StoryblokRichText.svelte";
export { defineStoryblokBlocks } from "./define-storyblok-blocks";
export * from "./types";

export {
  editableField,
  isInEditor,
  loadStoryblokBridge,
  onStoryblokEditorEvent,
  storyblokEditable,
} from "@storyblok/live-preview";
export type { BridgeParams, LivePreviewStory } from "@storyblok/live-preview";

export { buildStoryblokImage, renderRichText, splitTableRows } from "@storyblok/richtext";

export type {
  StoryblokRichTextElement,
  StoryblokRichTextImageOptions,
  StoryblokRichTextInput,
  StoryblokRichTextMark,
  StoryblokRichTextMarkWithKey,
  StoryblokRichTextNode,
  StoryblokRichTextNodeWithKey,
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

// Re-exporting helpers and types from @storyblok/richtext for StoryblokRichText.svelte component.
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
