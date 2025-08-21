import type { SpaceDatasource } from '../datasources/constants';

import type { ComponentFolders, Components, InternalTags, Presets } from '@storyblok/management-api-client';

export type SpaceComponent = Components.Component;
export type SpaceComponentGroup = ComponentFolders.ComponentFolder;
export type SpaceComponentPreset = Presets.Preset;
export type SpaceComponentInternalTag = InternalTags.InternalTag;

export interface SpaceComponentsData {
  components: SpaceComponent[];
  groups: SpaceComponentGroup[];
  presets: SpaceComponentPreset[];
  internalTags: SpaceComponentInternalTag[];
  datasources: SpaceDatasource[];
}

export interface SpaceComponentsDataState {
  local: SpaceComponentsData;
  target: {
    components: Map<string, SpaceComponent>;
    tags: Map<string, SpaceComponentInternalTag>;
    groups: Map<string, SpaceComponentGroup>;
    presets: Map<string, SpaceComponentPreset>;
    datasources: Map<string, SpaceDatasource>;
  };
}
