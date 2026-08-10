import type {
  RichTextDoc,
  RichTextFieldValueRichTextMark,
  RichTextFieldValueRichTextNode,
  RichTextMark,
  RichTextNode,
} from "../generated/overlay/types.gen";
import type { StoryblokRichTextImageOptions } from "../types";

/**
 * Union of every renderable element type in a Storyblok RichText document,
 * derived directly from the OpenAPI spec.
 *
 * Covers all 18 content node types and all 12 mark types.
 */
export type StoryblokRichTextElement = (RichTextNode | RichTextMark)["type"] | "doc";

/**
 * @deprecated Use {@link StoryblokRichTextElement} instead. Will be removed in the next major version.
 */
export type SbRichTextElement = StoryblokRichTextElement;

export interface StoryblokRichTextRenderSpec {
  tag: string;
  attrs?: Record<string, unknown> & {
    style?: string;
  };
  content?: boolean;
  children?: StoryblokRichTextRenderSpec[];
  resolve?: (attrs: unknown) => string;
}
/**
 * @deprecated Use {@link StoryblokRichTextRenderSpec} instead. Will be removed in the next major version.
 */
export type RenderSpec = StoryblokRichTextRenderSpec;

/** Canonical type for a Storyblok RichText JSON root. */
export type StoryblokRichTextDoc = RichTextDoc;

/**
 * @deprecated Use {@link StoryblokRichTextDoc} instead. Will be removed in the next major version.
 */
export type SbRichTextDoc = StoryblokRichTextDoc;

export type StoryblokRichTextNode = RichTextNode;
export type StoryblokRichTextMark = RichTextMark;

/**
 * A `StoryblokRichTextMark` with an added `_key` field for stable list
 * rendering. Produced by `normalizeNodes(input, true)`.
 */
export type StoryblokRichTextMarkWithKey = RichTextMark & { _key: string };
/**
 * A `StoryblokRichTextNode` with an added `_key` field for stable list
 * rendering. Produced by `normalizeNodes(input, true)`.
 *
 * The `content` and `marks` properties are recursively typed so nested
 * nodes/marks also carry `_key`. The base discriminated union is preserved —
 * narrow with `node.type` as usual.
 */
export type StoryblokRichTextNodeWithKey = RichTextNode & {
  _key: string;
  content?: StoryblokRichTextNodeWithKey[];
  marks?: StoryblokRichTextMarkWithKey[];
};

export type StoryblokRichTextTextNode = Extract<RichTextNode, { type: "text" }>;

/** @deprecated Use {@link StoryblokRichTextTextNode} instead. Will be removed in the next major version. */
export type SbRichTextTextNode = StoryblokRichTextTextNode;

export type StoryblokRichTextInput = RichTextDoc | RichTextNode | RichTextNode[] | null | undefined;

/**
 * @deprecated Use {@link StoryblokRichTextInput} instead. Will be removed in the next major version.
 */
export type SbRichTextInput = StoryblokRichTextInput;

/**
 * Flat map from element type string → generated OpenAPI interface.
 *
 * @internal
 */
type RichTextElementMap = {
  [N in RichTextFieldValueRichTextNode as N["type"]]: N;
} & { [M in RichTextFieldValueRichTextMark as M["type"]]: M } & {
  doc: RichTextDoc;
};

export type StoryblokRichTextProps<T extends StoryblokRichTextElement> = Omit<
  RichTextElementMap[T],
  "content" | "marks"
> & {
  content?: StoryblokRichTextNodeWithKey[];
  marks?: StoryblokRichTextMarkWithKey[];
  children: string;
  context?: StoryblokRichTextRenderContext;
};

/**
 * @deprecated Use {@link StoryblokRichTextProps} instead. Will be removed in the next major version.
 */
export type SbRichTextProps<T extends StoryblokRichTextElement> = StoryblokRichTextProps<T>;

/**
 * Component/render map for static renderers.
 */
export type StoryblokRichTextRendererMap = {
  [K in StoryblokRichTextElement]?: (props: StoryblokRichTextProps<K>) => string;
};

/**
 * @deprecated Use {@link StoryblokRichTextRendererMap} instead. Will be removed in the next major version.
 */
export type SbRichTextRendererMap = StoryblokRichTextRendererMap;

export interface StoryblokRichTextRenderContext {
  renderers?: StoryblokRichTextRendererMap;
  optimizeImage?: boolean | Partial<StoryblokRichTextImageOptions>;
  data?: unknown;
}

/**
 * @deprecated Use {@link StoryblokRichTextRenderContext} instead. Will be removed in the next major version.
 */
export type SbRichTextRenderContext = StoryblokRichTextRenderContext;

export { StoryblokRichTextImageOptions };
