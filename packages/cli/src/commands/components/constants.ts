import type { SpaceDatasource } from '../datasources/constants';

import type { ComponentFolders, Components, InternalTags, Presets } from '@storyblok/management-api-client';

export type SpaceComponent = Components.Component;
export type SpaceComponentCreate = Components.Component2;
export type SpaceComponentUpdate = Components.Component;

export type SpaceComponentFolder = ComponentFolders.ComponentFolder;
export type SpaceComponentFolderCreate = ComponentFolders.ComponentFolderInput;
export type SpaceComponentFolderUpdate = ComponentFolders.ComponentFolderUpdateInput;
export type SpaceComponentPreset = Presets.Preset;
export type SpaceComponentPresetCreate = Presets.PresetCreate;
export type SpaceComponentPresetUpdate = Presets.PresetUpdate;
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
