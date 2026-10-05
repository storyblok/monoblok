import type {
  RichTextDoc,
  RichTextFieldValueRichTextMark,
  RichTextFieldValueRichTextNode,
  RichTextMark,
  RichTextNode,
} from "../generated/overlay/types.gen";
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

/**
 * A block embedded in a richtext `blok` node. The renderer hands blocks to a custom
 * renderer without reading their fields, so a field can hold any value, e.g. a story
 * inlined by the Content Delivery API client.
 */
export type StoryblokRichTextBlokContent = {
  _uid?: string;
  component: string;
  _editable?: string;
  [key: string]: unknown;
};

type WithAnyBlokContent<TNode> = TNode extends { type: "blok" }
  ? {
      [K in keyof TNode]: K extends "attrs"
        ? {
            [A in keyof TNode[K]]: A extends "body"
              ? StoryblokRichTextBlokContent[] | null
              : TNode[K][A];
          }
        : TNode[K];
    }
  : { [K in keyof TNode]: K extends "content" ? WithAnyBlokContentArray<TNode[K]> : TNode[K] };

type WithAnyBlokContentArray<T> = T extends readonly (infer TNode)[]
  ? WithAnyBlokContent<TNode>[]
  : T;

export type StoryblokRichTextInput =
  | WithAnyBlokContent<RichTextDoc>
  | WithAnyBlokContent<RichTextNode>
  | WithAnyBlokContent<RichTextNode>[]
  | null
  | undefined;

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

/**
 * Represents the configuration options for optimizing images in rich text content.
 */
export interface StoryblokRichTextImageOptions {
  /**
   * CSS class to be applied to the image.
   */
  class: string;

  /**
   * Width of the image in pixels.
   */
  width: number;

  /**
   * Height of the image in pixels.
   */
  height: number;

  /**
   * Loading strategy for the image. 'lazy' loads the image when it enters the viewport. 'eager' loads the image immediately.
   */
  loading: "lazy" | "eager";

  /**
   * Optional filters that can be applied to the image to adjust its appearance.
   *
   * @example
   *
   * ```typescript
   * const filters: Partial<StoryblokRichTextImageOptions['filters']> = {
   *   blur: 5,
   *   brightness: 150,
   *   grayscale: true
   * }
   * ```
   */
  filters: Partial<{
    blur: number;
    brightness: number;
    fill: "transparent";
    format: "webp" | "png" | "jpg";
    grayscale: boolean;
    quality: number;
    rotate: 0 | 90 | 180 | 270;
  }>;

  /**
   * Defines a set of source set values that tell the browser different image sizes to load based on screen conditions.
   * The entries can be just the width in pixels or a tuple of width and pixel density.
   *
   * @example
   *
   * ```typescript
   * const srcset: (number | [number, number])[] = [
   *   320,
   *   [640, 2]
   * ]
   * ```
   */
  srcset: (number | [number, number])[];

  /**
   * A list of sizes that correspond to different viewport widths, instructing the browser on which srcset source to use.
   *
   * @example
   *
   * ```typescript
   * const sizes: string[] = [
   *   '(max-width: 320px) 280px',
   *   '(max-width: 480px) 440px',
   *   '800px'
   * ]
   * ```
   */
  sizes: string[];
}

/**
 * @deprecated Use {@link StoryblokRichTextImageOptions} instead. Will be removed in the next major version.
 */
export type SbRichTextImageOptions = StoryblokRichTextImageOptions;
