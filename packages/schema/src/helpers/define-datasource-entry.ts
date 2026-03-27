import type { DatasourceEntry } from '../types/datasource-entry';

const DATASOURCE_ENTRY_DEFAULTS = {
  id: 1,
};

type DatasourceEntryInput = { name: string; value: string } & Partial<Omit<DatasourceEntry, 'name' | 'value'>>;

/**
 * Defines a datasource entry object with type safety.
 * API-assigned fields (`id`) are optional and filled with safe defaults.
 *
 * @example
 * const entry = defineDatasourceEntry({ name: 'red', value: '#ff0000' });
 */
export const defineDatasourceEntry = (datasourceEntry: DatasourceEntryInput): DatasourceEntry => ({
  ...DATASOURCE_ENTRY_DEFAULTS,
  ...datasourceEntry,
});
