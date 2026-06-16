import type { Datasource as DatasourceGenerated } from '../generated/capi/types.gen';
import type { Override } from '../generated/types/_utils';
import type { Prettify } from '../utils/prettify';

const DATASOURCE_DEFAULTS = {
  id: 1,
  created_at: '',
  updated_at: '',
  dimensions: [],
};

/** Inline datasource entry (content-shape DSL). The CLI explodes these into MAPI entry payloads. */
export interface DatasourceEntryInput {
  name: string;
  value?: string;
  dimension_value?: string | null;
}

/** A Storyblok datasource with an optional inline `entries` list. */
export type Datasource = Override<DatasourceGenerated, { slug: string; entries?: DatasourceEntryInput[] }>;

/** Fields that have safe defaults and may be omitted from datasource input. */
type DatasourceOptional = keyof typeof DATASOURCE_DEFAULTS;

type DatasourceInput = Prettify<Omit<Datasource, DatasourceOptional> & Partial<Pick<Datasource, DatasourceOptional>>>;

/**
 * Returns a {@link Datasource} content-shape definition. Inline `entries` pass
 * through; the CLI reconciles them as the datasource's owned children.
 * A thin, strongly-typed helper — it does not validate or throw.
 *
 * @example
 * const colors = defineDatasource({
 *   name: 'Colors',
 *   slug: 'colors',
 *   entries: [{ name: 'Red', value: 'red' }],
 * });
 */
export function defineDatasource(datasource: DatasourceInput): Datasource;
export function defineDatasource(datasource: any) {
  return { ...DATASOURCE_DEFAULTS, ...datasource };
}
