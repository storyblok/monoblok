import type { Datasource } from '../generated/types';
import type { DatasourceCreate, DatasourceUpdate } from '../generated/mapi-types';
import type { Prettify } from '../utils/prettify';

const DATASOURCE_DEFAULTS = {
  id: 1,
  created_at: '',
  updated_at: '',
};

export type { Datasource, DatasourceCreate, DatasourceUpdate };

/** Fields that have safe defaults and may be omitted from datasource input. */
type DatasourceOptional = keyof typeof DATASOURCE_DEFAULTS;

type DatasourceInput = Prettify<Omit<Datasource, DatasourceOptional> & Partial<Pick<Datasource, DatasourceOptional>>>;

/**
 * Returns a full {@link Datasource} with all fields populated. API-assigned
 * fields are optional and default to safe values.
 *
 * @example
 * const myDatasource = defineDatasource({
 *   name: 'Colors',
 *   slug: 'colors',
 * });
 */
// Overload: provides the strict public signature for callers.
export function defineDatasource(datasource: DatasourceInput): Datasource;

// Implementation signature: uses a loose parameter type because
// TypeScript requires the implementation signature to be assignable
// to all overloads. Not visible to callers.
export function defineDatasource(datasource: any) {
  return { ...DATASOURCE_DEFAULTS, ...datasource };
}

/**
 * Defines a datasource creation payload for the MAPI.
 *
 * @example
 * const payload = defineDatasourceCreate({ name: 'Colors', slug: 'colors' });
 */
export const defineDatasourceCreate = (datasource: DatasourceCreate): DatasourceCreate => datasource;

/**
 * Defines a datasource update payload for the MAPI.
 *
 * @example
 * const payload = defineDatasourceUpdate({ name: 'Updated Colors' });
 */
export const defineDatasourceUpdate = (datasource: DatasourceUpdate): DatasourceUpdate => datasource;
