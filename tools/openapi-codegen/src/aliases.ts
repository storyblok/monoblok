/**
 * Public-name aliases applied during generation.
 *
 * Each entry maps an upstream OpenAPI schema (by `source` name in `spec`) to
 * the public TypeScript name (`emitAs`) the codegen tool writes into a
 * consumer's `src/generated/`. Upstream names never appear in committed output
 * unless the entry is an identity rename.
 *
 * `unwrap` strips a request envelope: e.g. `UpdateStoryRequest = { story: { ... }, force_update?: boolean }`
 * becomes `StoryUpdate = { ... }` (the body of the `story` property).
 *
 * Entries are grouped by spec for readability. The list grows per consumer
 * migration; add entries here when a new public name needs to be exposed.
 */

export type SpecSource = 'capi' | 'mapi' | 'overlay';

export interface AliasSpec {
  source: string;
  spec: SpecSource;
  emitAs: string;
  unwrap?: string;
}

export const ALIASES = [
  // CAPI
  { source: 'Story', spec: 'capi', emitAs: 'CapiStory' },
  { source: 'StoryAlternate', spec: 'capi', emitAs: 'StoryAlternate' },
  { source: 'Datasource', spec: 'capi', emitAs: 'Datasource' },
  { source: 'DatasourceEntry', spec: 'capi', emitAs: 'DatasourceEntry' },
  { source: 'Link', spec: 'capi', emitAs: 'Link' },
  { source: 'Tag', spec: 'capi', emitAs: 'Tag' },
  { source: 'CdnExperiment', spec: 'capi', emitAs: 'Experiment' },
  { source: 'CdnExperimentVariant', spec: 'capi', emitAs: 'ExperimentVariant' },

  // MAPI entities
  { source: 'Component', spec: 'mapi', emitAs: 'Component' },
  { source: 'ComponentCreateRequest', spec: 'mapi', emitAs: 'ComponentCreate', unwrap: 'component' },
  { source: 'ComponentUpdateRequest', spec: 'mapi', emitAs: 'ComponentUpdate', unwrap: 'component' },
  { source: 'Story', spec: 'mapi', emitAs: 'MapiStory' },
  { source: 'TranslatedSlug', spec: 'mapi', emitAs: 'StoryTranslatedSlug' },
  { source: 'LocalizedPath', spec: 'mapi', emitAs: 'StoryLocalizedPath' },
  // Sourced from `ShowAsset` (not `Asset` / V2Asset). The upstream `Asset` is
  // the slim PUT-response schema; `ShowAsset` is the canonical read shape
  // returned by GET/POST endpoints and includes id, space_id, short_filename,
  // locked, meta_data, internal_tags_list, etc.
  { source: 'ShowAsset', spec: 'mapi', emitAs: 'Asset' },
  { source: 'CreateAsset', spec: 'mapi', emitAs: 'AssetCreate' },
  { source: 'AssetUpdateRequest', spec: 'mapi', emitAs: 'AssetUpdate', unwrap: 'asset' },
  { source: 'AssetFolder', spec: 'mapi', emitAs: 'AssetFolder' },
  { source: 'CreateAssetFolderData', spec: 'mapi', emitAs: 'AssetFolderCreate', unwrap: 'body.asset_folder' },
  { source: 'UpdateAssetFolderData', spec: 'mapi', emitAs: 'AssetFolderUpdate', unwrap: 'body.asset_folder' },
  { source: 'ComponentGroup', spec: 'mapi', emitAs: 'ComponentFolder' },
  { source: 'ComponentGroupRequest', spec: 'mapi', emitAs: 'ComponentFolderCreate', unwrap: 'component_group' },
  { source: 'ComponentGroupRequest', spec: 'mapi', emitAs: 'ComponentFolderUpdate', unwrap: 'component_group' },
  { source: 'UpdateStoryRequest', spec: 'mapi', emitAs: 'StoryCreate', unwrap: 'story' },
  { source: 'UpdateStoryRequest', spec: 'mapi', emitAs: 'StoryUpdate', unwrap: 'story' },
  { source: 'DatasourceEntry', spec: 'mapi', emitAs: 'MapiDatasourceEntry' },
  { source: 'Datasource', spec: 'mapi', emitAs: 'MapiDatasource' },
  { source: 'CreateDatasourceRequest', spec: 'mapi', emitAs: 'DatasourceCreate', unwrap: 'datasource' },
  { source: 'UpdateDatasourceRequest', spec: 'mapi', emitAs: 'DatasourceUpdate', unwrap: 'datasource' },
  { source: 'CreateDatasourceEntryRequest', spec: 'mapi', emitAs: 'DatasourceEntryCreate', unwrap: 'datasource_entry' },
  { source: 'UpdateDatasourceEntryRequest', spec: 'mapi', emitAs: 'DatasourceEntryUpdate', unwrap: 'datasource_entry' },
  { source: 'InternalTag', spec: 'mapi', emitAs: 'InternalTag' },
  { source: 'InternalTagRequest', spec: 'mapi', emitAs: 'InternalTagCreate', unwrap: 'internal_tag' },
  { source: 'InternalTagRequest', spec: 'mapi', emitAs: 'InternalTagUpdate', unwrap: 'internal_tag' },
  { source: 'Preset', spec: 'mapi', emitAs: 'Preset' },
  { source: 'CreatePresetRequest', spec: 'mapi', emitAs: 'PresetCreate', unwrap: 'preset' },
  { source: 'UpdatePresetRequest', spec: 'mapi', emitAs: 'PresetUpdate', unwrap: 'preset' },
  { source: 'Space', spec: 'mapi', emitAs: 'Space' },
  { source: 'CreateSpaceRequest', spec: 'mapi', emitAs: 'SpaceCreate', unwrap: 'space' },
  { source: 'UpdateSpaceRequest', spec: 'mapi', emitAs: 'SpaceUpdate', unwrap: 'space' },
  { source: 'User', spec: 'mapi', emitAs: 'User' },
  { source: 'UserUpdateRequest', spec: 'mapi', emitAs: 'UserUpdate', unwrap: 'user' },

  // Overlay (supplementary schemas not yet in upstream openapi-wdx)
  { source: 'BlockContent', spec: 'overlay', emitAs: 'BlockContentBase' },
  { source: 'BlockContentInput', spec: 'overlay', emitAs: 'BlockContentInputBase' },
  { source: 'AssetFieldValue', spec: 'overlay', emitAs: 'AssetFieldValue' },
  { source: 'MultilinkFieldValue', spec: 'overlay', emitAs: 'MultilinkFieldValue' },
  { source: 'PluginFieldValue', spec: 'overlay', emitAs: 'PluginFieldValue' },
  { source: 'RichtextFieldValue', spec: 'overlay', emitAs: 'RichtextFieldValue' },
  { source: 'TableFieldValue', spec: 'overlay', emitAs: 'TableFieldValue' },
  { source: 'ComponentSchemaField', spec: 'overlay', emitAs: 'Field' },
] as const satisfies readonly AliasSpec[];

export const ALIAS_BY_EMIT_NAME: ReadonlyMap<string, AliasSpec> = new Map(
  ALIASES.map(a => [a.emitAs, a]),
);
