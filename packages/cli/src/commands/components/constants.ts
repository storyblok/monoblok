import type { SpaceDatasource } from '../datasources/constants';
import type { Component } from '@storyblok/mapi-client/resources/components';
import type { ComponentFolder } from '@storyblok/mapi-client/resources/component_folders';
import type { Preset } from '@storyblok/mapi-client/resources/presets';
import type { InternalTag } from '@storyblok/mapi-client/resources/internal_tags';

export type SpaceComponent = Component;
export type SpaceComponentGroup = ComponentFolder;
export type SpaceComponentPreset = Preset;
export type SpaceComponentInternalTag = InternalTag;

export interface SpaceComponentsData {
  components: Component[];
  groups: ComponentFolder[];
  presets: Preset[];
  internalTags: InternalTag[];
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
