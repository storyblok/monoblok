import type { SbRichTextImageOptions } from '../types';
import type { PMMark, PMNode, TiptapMarkName, TiptapNodeName } from './types.generated';

export type SbRichTextElement = Exclude<TiptapNodeName | TiptapMarkName, 'text'>;

export type HtmlTag = keyof HTMLElementTagNameMap;

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
export type SbRichTextDoc = PMNode;
export type TextNode = PMNode & { type: 'text' };

type ResolveRichTextElement<T extends SbRichTextElement> =
  T extends PMNode['type']
    ? Extract<PMNode, { type: T }>
    : T extends PMMark['type']
      ? Extract<PMMark, { type: T }>
      : never;

export type BaseSbRichTextProps<
  T extends SbRichTextElement,
  ExtraNodeProps extends object = object,
  ExtraMarkProps extends object = object,
> =
  T extends PMNode['type']
    ? ResolveRichTextElement<T> & ExtraNodeProps
    : T extends PMMark['type']
      ? ResolveRichTextElement<T> & ExtraMarkProps
      : never;

/** Base props for node/mark components */
export type SbRichTextProps<T extends SbRichTextElement> =
  BaseSbRichTextProps<T, object, { children: string }>;

/** Generic component map for any renderer target */

export type SbRichTextRenderers<TOutput> = {
  [K in SbRichTextElement]?: (props: SbRichTextProps<K>) => TOutput;
};
export interface SbRichTextOptions {
  renderers?: SbRichTextRenderers<string>;
  optimizeImages?: boolean | Partial<SbRichTextImageOptions>;
}

export { SbRichTextImageOptions };
