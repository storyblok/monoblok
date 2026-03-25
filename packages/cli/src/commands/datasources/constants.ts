import type { Datasource, DatasourceEntry } from '../../types';

export type { DatasourceEntry };

export const DEFAULT_DATASOURCES_FILENAME = 'datasources';

export type SpaceDatasource = Datasource & {
  entries?: DatasourceEntry[];
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
