import type { Component, Datasource, Field } from '../../types';

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

/**
 * Maps a content-shape DSL block (the result of `defineBlock`) to a MAPI wire
 * `Component`. The ordered `fields` array becomes a `schema` record keyed by
 * field name (each field keeps its `pos`); everything else passes through.
 */
export function mapBlockToWire(block: Record<string, unknown>): Component {
  const { fields, ...rest } = block;

  const schema: Record<string, Field> = {};
  if (Array.isArray(fields)) {
    for (const field of fields) {
      if (!isRecord(field)) { continue; }
      const { name, value } = mapFieldToWire(field);
      if (name) { schema[name] = value; }
    }
  }

  return { ...rest, schema } as unknown as Component;
}

/**
 * Maps a content-shape DSL datasource (the result of `defineDatasource`) to its
 * wire form. The DSL and wire shapes are identical, so this is a passthrough.
 */
export function mapDatasourceToWire(datasource: Record<string, unknown>): Datasource {
  return datasource as unknown as Datasource;
}
