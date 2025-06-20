import type { StoryblokPropertyType } from './storyblok';

export type ComponentPropertySchemaType =
  | StoryblokPropertyType
  | 'array'
  | 'bloks'
  | 'boolean'
  | 'custom'
  | 'datetime'
  | 'image'
  | 'markdown'
  | 'number'
  | 'option'
  | 'options'
  | 'text'
  | 'textarea';

export interface ComponentPropertySchemaOption {
  _uid: string;
  name: string;
  value: string;
}

export interface ComponentPropertySchema {
  asset_link_type?: boolean;
  component_group_whitelist?: string[];
  component_whitelist?: string[];
  email_link_type?: boolean;
  exclude_empty_option?: boolean;
  filter_content_type?: string | string[];
  key: string;
  options?: ComponentPropertySchemaOption[];
  pos: number;
  restrict_components?: boolean;
  restrict_type?: 'groups' | '';
  source?: 'internal' | 'external' | 'internal_stories' | 'internal_languages';
  type: ComponentPropertySchemaType;
  use_uuid?: boolean;
};
