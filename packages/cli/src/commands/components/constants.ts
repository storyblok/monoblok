import type { SpaceDatasource } from '../datasources/constants';

import type { ComponentFolders, Components, InternalTags, Presets } from '@storyblok/management-api-client';

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
