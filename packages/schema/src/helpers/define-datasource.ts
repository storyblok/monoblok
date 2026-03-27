import type { Datasource } from '../types/datasource';

/** Fields that are assigned by the API and can be omitted when defining a datasource. */
type DatasourceApiAssigned = 'id' | 'created_at' | 'updated_at';

/**
 * Input type for `defineDatasource` — all API-assigned fields are optional.
 * The output type (`Datasource`) still includes all fields.
 */
type DatasourceInput = Omit<Datasource, DatasourceApiAssigned> & Partial<Pick<Datasource, DatasourceApiAssigned>>;

const DATASOURCE_DEFAULTS = {
  id: 1,
  created_at: '',
  updated_at: '',
};

/**
 * Defines a datasource object with type safety.
 * API-assigned fields (`id`, `created_at`, `updated_at`) are optional and default
 * to safe placeholder values.
 *
 * @example
 * const myDatasource = defineDatasource({ name: 'Colors', slug: 'colors' });
 */
export const defineDatasource = (datasource: DatasourceInput): Datasource => ({
  ...DATASOURCE_DEFAULTS,
  ...datasource,
});
