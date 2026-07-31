import type { StoryblokRichTextMark, StoryblokRichTextNode } from './types';

// ── Utilities ─────────────────────────────────────────────────────────────────
export { processAttrs } from './attribute';
export {
  areLinkMarksEqual,
  getInnerMarks,
  getTextNodeLinkMark,
  groupLinkNodes,
  isTableHeaderRow,
  splitTableRows,
} from './node-helpers';
export { normalizeNodes } from './normalize-nodes';
export { stringToStyle, styleToString } from './style';
// ── Types (current public API) ────────────────────────────────────────────────
export type {
  RichTextMarkWithKey,
  RichTextNodeWithKey,
  StoryblokRichTextDoc,
  StoryblokRichTextElement,
  StoryblokRichTextImageOptions,
  StoryblokRichTextInput,
  StoryblokRichTextMark,
  StoryblokRichTextNode,
  StoryblokRichTextProps,
  StoryblokRichTextRenderContext,
  StoryblokRichTextRendererMap,
  StoryblokRichTextRenderSpec,
  StoryblokRichTextTextNode,
} from './types';

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
} from './types';

// SbRichTextNode, SbRichTextMark, SbRichTextElementByType will be removed
// when types.generated.ts is retired in the next major version.

export type SbRichTextMark = StoryblokRichTextMark;
export type SbRichTextNode = StoryblokRichTextNode;

export {
  attrsToHtmlString,
  getStaticChildren,
  isSelfClosing,
  resolveTag,
} from './util';
