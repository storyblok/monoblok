import type { SpaceDatasource } from '../datasources/constants';

import type { ComponentFolders, Components, InternalTags, Presets } from '@storyblok/management-api-client';

export const DEFAULT_COMPONENTS_FILENAME = 'components';
export const DEFAULT_GROUPS_FILENAME = 'groups';
export const DEFAULT_PRESETS_FILENAME = 'presets';
export const DEFAULT_TAGS_FILENAME = 'tags';

export type SpaceComponent = Components.Component;

export type SpaceComponentFolder = ComponentFolders.ComponentFolder;
export type SpaceComponentPreset = Presets.Preset;
export type SpaceComponentInternalTag = InternalTags.InternalTag;
// There is no create or update type for internal tags

export interface SpaceComponentsData {
  components: SpaceComponent[];
  groups: SpaceComponentFolder[];
  presets: SpaceComponentPreset[];
  internalTags: SpaceComponentInternalTag[];
  datasources: SpaceDatasource[];
}

export interface SpaceComponentsDataState {
  local: SpaceComponentsData;
  target: {
    components: Map<string, SpaceComponent>;
    tags: Map<string, SpaceComponentInternalTag>;
    groups: Map<string, SpaceComponentFolder>;
    presets: Map<string, SpaceComponentPreset>;
    datasources: Map<string, SpaceDatasource>;
  };
}
