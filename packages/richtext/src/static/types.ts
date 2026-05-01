import type { PMMark, PMNode, TiptapComponentName } from './types.generated';

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
export type StoryblokRichTextJson = PMNode;

/** Base props for node/mark components */
export type RichTextBaseProps<T extends TiptapComponentName> =
  T extends PMNode['type']
    ? Extract<PMNode, { type: T }>
    : T extends PMMark['type']
      ? Extract<PMMark, { type: T }> & { children: string }
      : never;

/** Generic component map for any renderer target */
export type StoryblokRichTextComponentMap<
  TComponent = string,
> = {
  [K in TiptapComponentName]?: (
    props: RichTextBaseProps<K>
  ) => TComponent;
};

export interface StoryblokRichTextRendererOptions {
  renderers?: StoryblokRichTextComponentMap<string>;
  optimizeImages?: boolean;
}
