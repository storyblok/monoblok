import type { DatasourceEntry } from '../generated/types';
import type { Prettify } from '../utils/prettify';

const DATASOURCE_ENTRY_DEFAULTS = {
  id: 1,
};

export type { DatasourceEntry };

/** Fields that have safe defaults and may be omitted from datasource entry input. */
type DatasourceEntryOptional = keyof typeof DATASOURCE_ENTRY_DEFAULTS;

type DatasourceEntryInput = Prettify<
  Omit<DatasourceEntry, DatasourceEntryOptional>
  & Partial<Pick<DatasourceEntry, DatasourceEntryOptional>>
>;

/**
 * Returns a full {@link DatasourceEntry} with all fields populated. API-assigned
 * fields are optional and default to safe values.
 *
 * @example
 * const entry = defineDatasourceEntry({
 *   name: 'red',
 *   value: '#ff0000',
 * });
 */
// Overload: provides the strict public signature for callers.
export function defineDatasourceEntry(datasourceEntry: DatasourceEntryInput): DatasourceEntry;

// Implementation signature: uses a loose parameter type because
// TypeScript requires the implementation signature to be assignable
// to all overloads. Not visible to callers.
export function defineDatasourceEntry(datasourceEntry: any) {
  return { ...DATASOURCE_ENTRY_DEFAULTS, ...datasourceEntry };
}
