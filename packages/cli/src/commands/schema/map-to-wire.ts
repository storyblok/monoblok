import type { Component, Datasource, DatasourceEntry, Field, Preset } from '../../types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Maps a single content-shape DSL field to its MAPI wire form. The field's
 * `name` becomes the schema record key (returned separately); the DSL reference
 * keys are renamed to their wire equivalents:
 * - `allow` → `component_whitelist`
 * - `datasource` → `datasource_slug` (the `source` selector passes through)
 *
 * Every other key (`type`, `pos`, `source`, `required`, validation options, and
 * `type: 'custom'` plugin extras) is preserved verbatim.
 */
export function mapFieldToWire(field: Record<string, unknown>): { name: string; value: Field } {
  const { name, allow, datasource, ...rest } = field;

  const value: Record<string, unknown> = { ...rest };
  if (allow !== undefined) { value.component_whitelist = allow; }
  if (datasource !== undefined) { value.datasource_slug = datasource; }

  // The wire `Field` is a loose, fully-optional index shape; the structural
  // contract is exercised by the map-to-wire tests rather than the compiler.
  return { name: typeof name === 'string' ? name : '', value: value as Field };
}

/** A block mapped to wire, with its inline `presets` lifted off for reconciliation. */
export interface BlockWire {
  component: Component;
  /** Inline `presets` lifted off the block; reconciled per component after upsert. */
  presets: Preset[];
}

/**
 * Maps a content-shape DSL block (the result of `defineBlock`) to a MAPI wire
 * `Component`. The ordered `fields` array becomes a `schema` record keyed by
 * field name (each field keeps its `pos`). Inline `presets` are lifted off and
 * returned separately for reconciliation; everything else passes through.
 */
export function mapBlockToWire(block: Record<string, unknown>): BlockWire {
  const { fields, presets, ...rest } = block;

  const schema: Record<string, Field> = {};
  if (Array.isArray(fields)) {
    for (const field of fields) {
      if (!isRecord(field)) { continue; }
      const { name, value } = mapFieldToWire(field);
      if (name) { schema[name] = value; }
    }
  }

  return {
    component: { ...rest, schema } as unknown as Component,
    presets: Array.isArray(presets) ? (presets as Preset[]) : [],
  };
}

/** A datasource mapped to wire, with its inline `entries` lifted off for reconciliation. */
export interface DatasourceWire {
  datasource: Datasource;
  /** Inline `entries` lifted off the datasource; reconciled per datasource after upsert. */
  entries: DatasourceEntry[];
}

/**
 * Maps a content-shape DSL datasource (the result of `defineDatasource`) to its
 * wire form, lifting off inline `entries` for separate reconciliation.
 */
export function mapDatasourceToWire(datasource: Record<string, unknown>): DatasourceWire {
  const { entries, ...rest } = datasource;

  return {
    datasource: rest as unknown as Datasource,
    entries: Array.isArray(entries) ? (entries as DatasourceEntry[]) : [],
  };
}
