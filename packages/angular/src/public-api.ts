/*
 * Public API Surface of angular-storyblok
 */

// Core service and provider
export { StoryblokService, type StoryblokClientConfig } from "./lib/storyblok.service";
export { provideStoryblok } from "./lib/storyblok.feature";
// Component registry
export { withStoryblokComponents, type StoryblokComponentsMap } from "./lib/components.feature";

// Live Preview feature (optional, tree-shakeable)
export { LivePreviewService } from "./lib/livepreview/livepreview.service";
export { withLivePreview } from "./lib/livepreview/livepreview.feature";
export { type BridgeParams } from "@storyblok/live-preview";

// Storyblok Component
export { StoryblokComponent } from "./lib/blok/sb-component.component";

// Directive
export { SbBlokDirective } from "./lib/blok/sb-blok.directive";

// Rich Text (with custom component overrides)
export { SbRichTextComponent } from "./lib/richtext/rich-text.component";
export { withStoryblokRichtextComponents } from "./lib/richtext/richtext.feature";
export type {
  StoryblokAngularRichTextComponent,
  StoryblokAngularRichTextComponentMap,
  StoryblokAngularRichTextProps,
  StoryblokAngularRichTextRenderContext,
} from "./lib/richtext/richtext.feature";

// ── Deprecated: Sb* aliases — will be removed in the next major version ───────
export type {
  SbAngularComponentMap,
  SbAngularRichTextComponentMap,
  SbAngularRichTextComponent,
  SbAngularRichTextProps,
  SbAngularRichTextRenderContext,
} from "./lib/richtext/richtext.feature";

export type { Story } from "@storyblok/api-client";
export * from "./lib/types";

// Re-exporting same exports from @storyblok/richtext
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
  SbRichTextImageOptions,
  SbRichTextMark,
  SbRichTextNode,
  SbRichTextProps,
  SbRichTextRenderContext,
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
