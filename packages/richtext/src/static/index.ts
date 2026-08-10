import type { StoryblokRichTextElementByType } from "./richtext-element-types.generated";
import type { StoryblokRichTextMark, StoryblokRichTextNode } from "./types";

// ── Utilities ─────────────────────────────────────────────────────────────────
export { processAttrs } from "./attribute";
export {
  areLinkMarksEqual,
  getInnerMarks,
  getTextNodeLinkMark,
  groupLinkNodes,
  isTableHeaderRow,
  splitTableRows,
} from "./node-helpers";
export { normalizeNodes } from "./normalize-nodes";
export type { StoryblokRichTextElementByType } from "./richtext-element-types.generated";

export { stringToStyle, styleToString } from "./style";

// ── Types (current public API) ────────────────────────────────────────────────
export type {
  StoryblokRichTextDoc,
  StoryblokRichTextElement,
  StoryblokRichTextImageOptions,
  StoryblokRichTextInput,
  StoryblokRichTextMark,
  StoryblokRichTextMarkWithKey,
  StoryblokRichTextNode,
  StoryblokRichTextNodeWithKey,
  StoryblokRichTextProps,
  StoryblokRichTextRenderContext,
  StoryblokRichTextRendererMap,
  StoryblokRichTextRenderSpec,
  StoryblokRichTextTextNode,
} from "./types";

// ── Deprecated: Sb* aliases — will be removed in the next major version ───────
export type {
  RenderSpec,
  SbRichTextDoc,
  SbRichTextElement,
  SbRichTextInput,
  SbRichTextProps,
  SbRichTextRenderContext,
  SbRichTextRendererMap,
  SbRichTextTextNode,
} from "./types";

/** @deprecated Use {@link StoryblokRichTextMark} instead. Will be removed in the next major version. */
export type SbRichTextMark = StoryblokRichTextMark;
/** @deprecated Use {@link StoryblokRichTextNode} instead. Will be removed in the next major version. */
export type SbRichTextNode = StoryblokRichTextNode;
/** @deprecated Use {@link StoryblokRichTextElementByType} instead. Will be removed in the next major version. */
export type SbRichTextElementByType<TContext = unknown> = StoryblokRichTextElementByType<TContext>;

export {
  attrsToHtmlString,
  getStaticChildren,
  hasContent,
  isSelfClosing,
  resolveTag,
} from "./util";
