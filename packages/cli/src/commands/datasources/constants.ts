import type { DatasourceEntries, Datasources } from '@storyblok/management-api-client';

export const DEFAULT_DATASOURCES_FILENAME = 'datasources';

export type SpaceDatasourceEntry = DatasourceEntries.DatasourceEntry;
export type SpaceDatasource = Datasources.Datasource & {
  entries?: SpaceDatasourceEntry[];
};

export interface SpaceDatasourcesData {
  datasources: SpaceDatasource[];
}

export interface SpaceDatasourcesDataState {
  local: SpaceDatasourcesData;
  target: {
    datasources: Map<string, SpaceDatasource>;
  };
}
