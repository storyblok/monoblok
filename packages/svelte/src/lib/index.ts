export {
  type StoryblokSvelteRichTextComponentMap,
  type StoryblokSvelteRichTextProps,
  type StoryblokSvelteRichTextRenderContext,
} from "./richtext-helpers";

// ── Deprecated: Sb* aliases — will be removed in the next major version ───────
export {
  type SbSvelteRichTextComponentMap,
  type SbSvelteRichTextProps,
  type SbSvelteRichTextRenderContext,
} from "./richtext-helpers";

export * from "./storyblok";
export { default as StoryblokComponent } from "./StoryblokComponent.svelte";
export { default as StoryblokRichText } from "./StoryblokRichText.svelte";
export * from "./types";

export { apiPlugin, useStoryblokBridge } from "@storyblok/js";

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
