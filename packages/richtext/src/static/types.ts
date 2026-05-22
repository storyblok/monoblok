import type { SbRichTextImageOptions } from '../types';
import type { SbRichTextMark, SbRichTextNode, TiptapMarkName, TiptapNodeName } from './types.generated';

export type SbRichTextElement = Exclude<TiptapNodeName | TiptapMarkName, 'text'>;

interface ISbComponentType<T extends string> {
  _uid?: string;
  component?: T;
  _editable?: string;
}
type SbBlokKeyDataTypes = string | number | object | boolean | undefined;

export interface SbBlokData extends ISbComponentType<string> {
  [index: string]: SbBlokKeyDataTypes;
}

export interface RenderSpec {
  tag: string;
  attrs?: Record<string, unknown> & {
    style?: string;
  };
  content?: boolean;
  children?: RenderSpec[];
  resolve?: (attrs: unknown) => string;
}

/** Canonical type for a Storyblok RichText JSON root */
export type SbRichTextDoc = SbRichTextNode & { type: 'doc' };
export type SbRichTextTextNode = SbRichTextNode & { type: 'text' };

type ResolveRichTextElement<T extends SbRichTextElement> =
  T extends SbRichTextNode['type']
    ? Extract<SbRichTextNode, { type: T }>
    : T extends SbRichTextMark['type']
      ? Extract<SbRichTextMark, { type: T }>
      : never;

export type BaseSbRichTextProps<
  T extends SbRichTextElement,
  ExtraNodeProps extends object = object,
  ExtraMarkProps extends object = object,
> =
  T extends SbRichTextNode['type']
    ? ResolveRichTextElement<T> & ExtraNodeProps
    : T extends SbRichTextMark['type']
      ? ResolveRichTextElement<T> & ExtraMarkProps
      : never;

/** Base props for node/mark components */
export type SbRichTextProps<T extends SbRichTextElement> =
  BaseSbRichTextProps<T, { children: string }, { children: string }>;

export type SbRichTextRendererMap<
  TOutput,
  TProps extends {
    [K in SbRichTextElement]: unknown;
  },
> = {
  [K in SbRichTextElement]?: (props: TProps[K]) => TOutput;
};
/**
 * Static renderer function.
 */
export type SbRichTextRenderer<
  T extends SbRichTextElement,
  TOutput,
> = (
  props: SbRichTextProps<T>,
) => TOutput;
/**
 * Component/render map for static renderers.
 */
export type SbRichTextRenderers<TOutput> = {
  [K in SbRichTextElement]?: SbRichTextRenderer<K, TOutput>;
};
export interface SbRichTextOptions {
  renderers?: SbRichTextRenderers<string>;
  optimizeImages?: boolean | Partial<SbRichTextImageOptions>;
}

export { SbRichTextImageOptions };
