import type { PMMark, PMNode, TiptapComponentName } from "./types.generated";

/** Valid attribute values for DOM elements */
export type AttrValue = string | number | boolean;
export type HtmlTag = keyof HTMLElementTagNameMap;
export interface SbBlokData {
  _key: string;
  component: string;
  [otherKey: string]: unknown;
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
export type RichTextBaseProps<T extends TiptapComponentName> = T extends PMNode["type"]
  ? Extract<PMNode, { type: T }>
  : T extends PMMark["type"]
    ? Extract<PMMark, { type: T }>
    : never;

/** Typed override map for node/mark components */
export type RichTextComponentProps<
  T extends TiptapComponentName,
  TComponent = unknown,
  ExtraProps extends Record<string, unknown> = Record<string, never>,
> = RichTextBaseProps<T> &
  ExtraProps & {
    components?: StoryblokRichTextComponentMap<TComponent, ExtraProps>;
  };

export type StoryblokRichTextComponentMap<
  TComponent = unknown,
  ExtraProps extends Record<string, unknown> = Record<string, never>,
> = {
  [K in TiptapComponentName]?: (
    props: RichTextComponentProps<K, TComponent, ExtraProps>,
  ) => TComponent;
};
