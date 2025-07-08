export interface SpaceDatasourceDimension {
  name: string;
  type: string;
  entry_value: string;
  datasource_id: number;
  created_at: string;
  updated_at: string;
}

export interface SpaceDatasourceEntry {
  id: number;
  name: string;
  value: string;
  dimension_value: string;
}

export interface SpaceDatasource {
  id: number;
  name: string;
  slug: string;
  dimensions: SpaceDatasourceDimension[];
  created_at: string;
  updated_at: string;
  /**
   * Optionally include entries when resolving datasources with their entries
   */
  entries?: SpaceDatasourceEntry[];
}

export interface SpaceDatasourcesData {
  datasources: SpaceDatasource[];
}

export interface SpaceDatasourcesDataState {
  local: SpaceDatasourcesData;
  target: {
    datasources: Map<string, SpaceDatasource>;
  };
}
