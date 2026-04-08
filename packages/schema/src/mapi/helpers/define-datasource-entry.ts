import type { DatasourceEntry, DatasourceEntryCreate, DatasourceEntryUpdate } from '../../generated/mapi-types';

export type { DatasourceEntry, DatasourceEntryCreate, DatasourceEntryUpdate };

const DATASOURCE_ENTRY_DEFAULTS = {
  id: 1,
};

type DatasourceEntryInput = { name: string; datasource_id: number } & Partial<Omit<DatasourceEntry, 'name' | 'datasource_id'>>;

/**
 * Defines a datasource entry for the MAPI.
 * API-assigned fields (`id`) are optional and filled with safe defaults.
 *
 * @example
 * import { defineDatasourceEntry } from '@storyblok/schema/mapi';
 * const entry = defineDatasourceEntry({ name: 'red', datasource_id: 42 });
 */
export const defineDatasourceEntry = (datasourceEntry: DatasourceEntryInput): DatasourceEntry => ({
  ...DATASOURCE_ENTRY_DEFAULTS,
  ...datasourceEntry,
});

/**
 * Defines a datasource entry creation payload for the MAPI.
 *
 * @example
 * import { defineDatasourceEntryCreate } from '@storyblok/schema/mapi';
 * const payload = defineDatasourceEntryCreate({ name: 'red', value: '#ff0000', datasource_id: 42 });
 */
export const defineDatasourceEntryCreate = (datasourceEntry: DatasourceEntryCreate): DatasourceEntryCreate => datasourceEntry;

/**
 * Defines a datasource entry update payload for the MAPI.
 *
 * @example
 * import { defineDatasourceEntryUpdate } from '@storyblok/schema/mapi';
 * const payload = defineDatasourceEntryUpdate({ value: '#ff0000' });
 */
export const defineDatasourceEntryUpdate = (datasourceEntry: DatasourceEntryUpdate): DatasourceEntryUpdate => datasourceEntry;
