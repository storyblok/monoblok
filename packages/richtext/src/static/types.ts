import type { SbRichTextImageOptions } from '../types';
import type { SbRichTextElementByType, SbRichTextNode, TiptapMarkName, TiptapNodeName } from './types.generated';

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
export type SbRichTextInput = SbRichTextNode | SbRichTextNode[] | null | undefined;

export type SbRichTextProps<
  T extends SbRichTextElement,
> =
  SbRichTextElementByType<SbRichTextRenderContext>[T]
  & {
    children: string;
  };
/**
 * Component/render map for static renderers.
 */
export type SbRichTextRendererMap = {
  [K in SbRichTextElement]?: (props: SbRichTextProps<K>) => string;
};

export interface SbRichTextRenderContext {
  renderers?: SbRichTextRendererMap;
  optimizeImage?: boolean | Partial<SbRichTextImageOptions>;
}

export { SbRichTextImageOptions };
