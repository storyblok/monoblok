import type { SpaceDatasource } from '../datasources/constants';

import type { Component, ComponentFolder, InternalTag, Preset } from '../../types';

export type { Component, ComponentFolder, InternalTag, Preset };

export const DEFAULT_COMPONENTS_FILENAME = 'components';
export const DEFAULT_GROUPS_FILENAME = 'groups';
export const DEFAULT_PRESETS_FILENAME = 'presets';
export const DEFAULT_TAGS_FILENAME = 'tags';

// There is no create or update type for internal tags

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
    components: Map<string, Component>;
    tags: Map<string, InternalTag>;
    groups: Map<string, ComponentFolder>;
    presets: Map<string, Preset>;
    datasources: Map<string, SpaceDatasource>;
  };
}
