import type { Datasource as DatasourceGenerated } from '../generated/capi/types.gen';
import type { Override } from '../generated/types/_utils';
import type { Prettify } from '../utils/prettify';

const DATASOURCE_DEFAULTS = {
  id: 1,
  created_at: '',
  updated_at: '',
  dimensions: [],
};

/**
 * A Storyblok datasource content shape. Carries the datasource definition only
 * (`name`, `slug`, dimensions). Entry values are content authored by editors,
 * not part of the schema, so they are neither modelled nor pushed here.
 */
export type Datasource = Override<DatasourceGenerated, { slug: string }>;

/** Fields that have safe defaults and may be omitted from datasource input. */
type DatasourceOptional = keyof typeof DATASOURCE_DEFAULTS;

type DatasourceInput = Prettify<Omit<Datasource, DatasourceOptional> & Partial<Pick<Datasource, DatasourceOptional>>>;

/**
 * Returns a {@link Datasource} content-shape definition. A thin, strongly-typed
 * helper — it does not validate or throw.
 *
 * @example
 * const colors = defineDatasource({ name: 'Colors', slug: 'colors' });
 */
export function defineDatasource(datasource: DatasourceInput): Datasource;
export function defineDatasource(datasource: any) {
  return { ...DATASOURCE_DEFAULTS, ...datasource };
}
