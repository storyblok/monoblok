export enum BlockTypes {
  DOCUMENT = 'doc',
  HEADING = 'heading',
  PARAGRAPH = 'paragraph',
  QUOTE = 'blockquote',
  OL_LIST = 'ordered_list',
  UL_LIST = 'bullet_list',
  LIST_ITEM = 'list_item',
  CODE_BLOCK = 'code_block',
  HR = 'horizontal_rule',
  BR = 'hard_break',
  IMAGE = 'image',
  EMOJI = 'emoji',
  COMPONENT = 'blok',
  TABLE = 'table',
  TABLE_ROW = 'tableRow',
  TABLE_CELL = 'tableCell',
  TABLE_HEADER = 'tableHeader',
}

export enum MarkTypes {
  BOLD = 'bold',
  STRONG = 'strong',
  STRIKE = 'strike',
  UNDERLINE = 'underline',
  ITALIC = 'italic',
  CODE = 'code',
  LINK = 'link',
  ANCHOR = 'anchor',
  STYLED = 'styled',
  SUPERSCRIPT = 'superscript',
  SUBSCRIPT = 'subscript',
  TEXT_STYLE = 'textStyle',
  HIGHLIGHT = 'highlight',
}

export enum TextTypes {
  TEXT = 'text',
}

export enum LinkTargets {
  SELF = '_self',
  BLANK = '_blank',
}

export enum LinkTypes {
  URL = 'url',
  STORY = 'story',
  ASSET = 'asset',
  EMAIL = 'email',
}

export interface StoryblokRichTextDocumentNode {
  type: string;
  content?: StoryblokRichTextDocumentNode[];
  attrs?: Record<string, any>;
  text?: string;
  marks?: StoryblokRichTextDocumentNode[];
}

export type StoryblokRichTextNodeTypes = BlockTypes | MarkTypes | TextTypes;

export interface StoryblokRichTextNode<T = string> {
  type: StoryblokRichTextNodeTypes;
  content: StoryblokRichTextNode<T>[];
  children?: T;
  attrs?: Record<string, any>;
  text?: string;
}

export interface LinkNode<T = string> extends StoryblokRichTextNode<T> {
  type: MarkTypes.LINK | MarkTypes.ANCHOR;
  linktype: LinkTypes.ASSET | LinkTypes.EMAIL | LinkTypes.STORY | LinkTypes.URL;
  attrs: Record<string, any>;
}

export interface MarkNode<T = string> extends StoryblokRichTextNode<T> {
  type: MarkTypes.BOLD |
    MarkTypes.ITALIC |
    MarkTypes.UNDERLINE |
    MarkTypes.STRIKE |
    MarkTypes.CODE |
    MarkTypes.LINK |
    MarkTypes.ANCHOR |
    MarkTypes.STYLED |
    MarkTypes.SUPERSCRIPT |
    MarkTypes.SUBSCRIPT |
    MarkTypes.TEXT_STYLE |
    MarkTypes.HIGHLIGHT;
  attrs?: Record<string, any>;
  linkType: LinkTypes;
}

export interface TextNode<T = string> extends StoryblokRichTextNode<T> {
  type: TextTypes.TEXT;
  text: string;
  marks?: MarkNode<T>[];
}

/**
 * Represents the render context provided to resolvers
 * @template T - The type of the resolved value
 */
export interface StoryblokRichTextContext<T = string> {
  /**
   * Render function that automatically handles key generation
   * @param tag - The HTML tag to render
   * @param attrs - The attributes for the tag
   * @param children - Optional children content
   */
  render: (tag: string, attrs?: Record<string, any>, children?: T) => T;
  /**
   * Original resolvers map
   */
  originalResolvers: Map<StoryblokRichTextNodeTypes, StoryblokRichTextNodeResolver<T>>;
  /**
   * Merged resolvers map
   */
  mergedResolvers: Map<StoryblokRichTextNodeTypes, StoryblokRichTextNodeResolver<T>>;
}

/**
 * Represents a resolver function for a Storyblok rich text node.
 * @template T - The type of the resolved value.
 * @param node - The rich text node to resolve.
 * @param context - The render context with utilities
 * @returns The resolved value of type T.
 */
export type StoryblokRichTextNodeResolver<T = string> = (
  node: StoryblokRichTextNode<T> | TextNode<T> | MarkNode<T> | LinkNode<T>,
  context: StoryblokRichTextContext<T>
) => T;

/**
 * Represents the configuration options for optimizing images in rich text content.
 */
export interface StoryblokRichTextImageOptimizationOptions {
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
  loading: 'lazy' | 'eager';

  /**
   * Optional filters that can be applied to the image to adjust its appearance.
   *
   * @example
   *
   * ```typescript
   * const filters: Partial<StoryblokRichTextImageOptimizationOptions['filters']> = {
   *   blur: 5,
   *   brightness: 150,
   *   grayscale: true
   * }
   * ```
   */
  filters: Partial<{
    blur: number;
    brightness: number;
    fill: 'transparent';
    format: 'webp' | 'png' | 'jpg';
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
 * Resolvers for Storyblok RichText nodes.
 *
 * @template T - The type of the resolved value.
 */
export type StoryblokRichTextResolvers<T = string> = Partial<Record<StoryblokRichTextNodeTypes, StoryblokRichTextNodeResolver<T>>>;

/**
 * Represents the options for rendering rich text.
 */
export interface StoryblokRichTextOptions<T = string, S = (tag: string, attrs: Record<string, any>, children?: T) => T> {
  /**
   * Defines the function that will be used to render the final HTML string (vanilla) or Framework component (React, Vue).
   *
   * @example
   *
   * ```typescript
   * const renderFn = (tag: string, attrs: Record<string, any>, text?: string) => {
   *  return `<${tag} ${Object.keys(attrs).map(key => `${key}="${attrs[key]}"`).join(' ')}>${text}</${tag}>`
   * }
   *
   * const options: StoryblokRichTextOptions = {
   *  renderFn
   * }
   * ```
   */
  renderFn?: S;

  /**
   * Defines the function that will be used to render HTML text.
   *
   * @example
   *
   * ```typescript
   * import { h, createTextVNode } from 'vue'
   *
   * const options: StoryblokRichTextOptions = {
   *  renderFn: h,
   *  textFn: createTextVNode
   * }
   * ```
   */
  textFn?: (text: string, attrs?: Record<string, any>) => T;

  /**
   * Defines the resolvers for each type of node.
   *
   * @example
   *
   * ```typescript
   * const options: StoryblokRichTextOptions = {
   *  resolvers: {
   *    [MarkTypes.LINK]: (node: StoryblokRichTextNode) => {
   *      return `<a href="${node.attrs.href}">${node.text}</a>`
   *    }
   *  }
   * }
   * ```
   */
  resolvers?: StoryblokRichTextResolvers<T>;

  /**
   * Defines opt-out image optimization options.
   *
   * @example
   *
   * ```typescript
   * const options: StoryblokRichTextOptions = {
   *  optimizeImages: true
   * }
   * ```
   *
   * @example
   *
   * ```typescript
   * const options: StoryblokRichTextOptions = {
   *    optimizeImages: {
   *    class: 'my-image',
   *    width: 800,
   *    height: 600,
   *    loading: 'lazy',
   * }
   * ```
   */
  optimizeImages?: boolean | Partial<StoryblokRichTextImageOptimizationOptions>;
  /**
   * Defines whether to use the key attribute in the resolvers for framework use cases.
   * @default false
   * @example
   *
   * ```typescript
   *
   * const options: StoryblokRichTextOptions = {
   *  renderFn: h,
   *  keyedResolvers: true
   * }
   * ```
   */
  keyedResolvers?: boolean;
}
