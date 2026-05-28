import type { DatasourceEntry as CapiDatasourceEntry } from '../generated/capi/types.gen';
import type { DatasourceEntryCreate, DatasourceEntryUpdate, MapiDatasourceEntry as MapiDatasourceEntryGenerated } from '../generated/mapi/types.gen';
import type { Prettify } from '../utils/prettify';

const DATASOURCE_ENTRY_DEFAULTS = {
  id: 1,
  value: '',
  dimension_value: null,
};

export type DatasourceEntry = CapiDatasourceEntry;
export type MapiDatasourceEntry = MapiDatasourceEntryGenerated;
export type { DatasourceEntryCreate, DatasourceEntryUpdate };

type DatasourceEntryOptional = keyof typeof DATASOURCE_ENTRY_DEFAULTS;

type DatasourceEntryInput = Prettify<
  Omit<CapiDatasourceEntry, DatasourceEntryOptional>
  & Partial<Pick<CapiDatasourceEntry, DatasourceEntryOptional>>
>;

type MapiDatasourceEntryInput = { name: string } & Partial<Omit<MapiDatasourceEntryGenerated, 'name'>>;

/**
 * Returns a full {@link DatasourceEntry} (CDN shape) with all fields populated.
 *
 * @example
 * const entry = defineDatasourceEntry({ name: 'red', value: '#ff0000' });
 */
export function defineDatasourceEntry(datasourceEntry: DatasourceEntryInput): DatasourceEntry;

export function defineDatasourceEntry(datasourceEntry: any) {
  return { ...DATASOURCE_ENTRY_DEFAULTS, ...datasourceEntry };
}

/**
 * Returns a full {@link MapiDatasourceEntry} (MAPI shape) with all fields populated.
 * Requires `datasource_id` to identify which datasource the entry belongs to.
 *
 * @example
 * const entry = defineMapiDatasourceEntry({ name: 'red', datasource_id: 42 });
 */
export const defineMapiDatasourceEntry = (entry: MapiDatasourceEntryInput): MapiDatasourceEntry => ({
  ...DATASOURCE_ENTRY_DEFAULTS,
  ...entry,
  value: entry.value ?? DATASOURCE_ENTRY_DEFAULTS.value,
  dimension_value: entry.dimension_value ?? DATASOURCE_ENTRY_DEFAULTS.dimension_value,
});

/**
 * Defines a datasource entry creation payload for the MAPI.
 *
 * @example
 * const payload = defineDatasourceEntryCreate({ name: 'red', value: '#ff0000', datasource_id: 42 });
 */
export const defineDatasourceEntryCreate = (entry: DatasourceEntryCreate): DatasourceEntryCreate => entry;

/**
 * Defines a datasource entry update payload for the MAPI.
 *
 * @example
 * const payload = defineDatasourceEntryUpdate({ value: '#ff0000' });
 */
export const defineDatasourceEntryUpdate = (entry: DatasourceEntryUpdate): DatasourceEntryUpdate => entry;
