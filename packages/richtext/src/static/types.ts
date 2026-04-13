import type { PMMark, PMNode, TiptapComponentName } from './types.generated';

export interface SbBlokData {
  _key: string;
  component: string;
  [otherKey: string]: any;
}

export interface RenderSpec {
  tag: string;
  attrs?: Record<string, any>;
  content?: boolean;
  children?: RenderSpec[];
  resolve?: (attrs: unknown) => string;
};

/** Canonical type for a Storyblok RichText JSON root */
export type StoryblokRichTextJson = PMNode;

/** Typed override map for node/mark components */
export type RichTextComponentProps<T extends TiptapComponentName> =
  (
    T extends PMNode['type']
      ? Extract<PMNode, { type: T }>
      : T extends PMMark['type']
        ? Extract<PMMark, { type: T }>
        : never
  ) & {
    components?: StoryblokRichTextComponentMap;
  };

export type StoryblokRichTextComponentMap<
  R = any,
  ExtraProps extends object = object,
> = {
  [K in TiptapComponentName]?: (
    props: RichTextComponentProps<K> & ExtraProps
  ) => R;
};
