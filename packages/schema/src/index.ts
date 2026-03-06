// Generated CAPI field/story types re-exported so that downstream DTS bundlers
// can resolve them without reaching into internal dist paths (TS2742).
export type {
  AssetField,
  MultilinkField,
  PluginField,
  RichtextField,
  Story as StoryCapi,
  StoryAlternate,
  StoryBase,
  StoryContent as StoryContentCapi,
  StoryLocalizedPath,
  StoryTranslatedSlug,
  TableField,
} from './generated/types';

// Define helpers (zero runtime dependencies — pure identity functions)
export { defineAsset } from './helpers/define-asset';
export { defineComponent } from './helpers/define-component';
export { defineDatasource } from './helpers/define-datasource';
export { defineField } from './helpers/define-field';
export { defineProp } from './helpers/define-prop';
export { defineStory } from './helpers/define-story';

// Types
export type { Asset } from './types/asset';
export type { Component, ComponentSchema } from './types/component';
export type { Datasource } from './types/datasource';
export type { Field, FieldType, FieldTypeValueMap, FieldValue } from './types/field';
export type { Prop, PropConfig } from './types/prop';
export type { Story, StoryContent } from './types/story';
export type { Prettify } from './types/utils';
