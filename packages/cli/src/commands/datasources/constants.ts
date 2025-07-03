export interface SpaceDatasourceDimension {
  name: string;
  type: string;
  entry_value: string;
  datasource_id: number;
  created_at: string;
  updated_at: string;
}

export interface SpaceDatasource {
  id: number;
  name: string;
  slug: string;
  dimensions: SpaceDatasourceDimension[];
  created_at: string;
  updated_at: string;
}
