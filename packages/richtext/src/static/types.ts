import type { PMMark, PMNode, TiptapComponentName } from './types.generated';

export interface SbBlokData {
  _key: string;
  component: string;
  [otherKey: string]: any;
}
/** Canonical type for a Storyblok RichText JSON root */
export type StoryblokRichTextJson = Extract<PMNode, { type: 'doc' }>;

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

export type StoryblokRichTextComponentMap = {
  [K in TiptapComponentName]?: (
    props: RichTextComponentProps<K>
  ) => any;
};
