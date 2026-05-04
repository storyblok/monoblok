import type { StoryblokRichTextImageOptimizationOptions as SbRichTextImageOptions } from '../types';
import type { PMMark, PMNode, TiptapMarkName, TiptapNodeName } from './types.generated';

export type SbRichTextElement = Exclude<TiptapNodeName | TiptapMarkName, 'text'>;

/** Valid attribute values for DOM elements */
export type AttrValue = string | number | boolean;
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
  attrs?: Record<string, AttrValue> & {
    style?: string;
  };
  content?: boolean;
  children?: RenderSpec[];
  resolve?: (attrs: unknown) => string;
}

/** Canonical type for a Storyblok RichText JSON root */
export type SbRichTextDoc = PMNode;

/** Base props for node/mark components */
export type SbRichTextProps<T extends SbRichTextElement> =
  T extends PMNode['type']
    ? Extract<PMNode, { type: T }>
    : T extends PMMark['type']
      ? Extract<PMMark, { type: T }> & { children: string }
      : never;

/** Generic component map for any renderer target */
export type SbRichTextComponents<
  TComponent = string,
> = {
  [K in SbRichTextElement]?: (
    props: SbRichTextProps<K>
  ) => TComponent;
};

export interface SbRichTextOptions {
  renderers?: SbRichTextComponents<string>;
  optimizeImages?: boolean | Partial<SbRichTextImageOptions>;
}

export { SbRichTextImageOptions };
