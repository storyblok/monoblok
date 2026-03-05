import type { Datasource, DatasourceEntry } from '@storyblok/management-api-client';

export const DEFAULT_DATASOURCES_FILENAME = 'datasources';

export type SpaceDatasourceEntry = DatasourceEntry;
export type SpaceDatasource = Datasource & {
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
