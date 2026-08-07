import type { Datasource, DatasourceEntry } from '../../types';

export type { DatasourceEntry };

export const DEFAULT_DATASOURCES_FILENAME = 'datasources';

/**
 * Local representation of a datasource entry. Where the API returns a single
 * scalar `dimension_value` per request, the local file stores the value for
 * every defined dimension in `dimension_values`, keyed by dimension code
 * (`entry_value`, e.g. `en`) so datasources stay portable across spaces.
 */
export type SpaceDatasourceEntry = Omit<DatasourceEntry, 'dimension_value'> & {
  dimension_values?: Record<string, string>;
};

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
