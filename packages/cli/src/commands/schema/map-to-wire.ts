import type { Component, Datasource, Field } from '../../types';
import { isRecord } from './utils';
import { slugifyPath } from './folders';

/**
 * Maps a single content-shape DSL field to its MAPI wire form. The field's
 * `name` becomes the schema record key (returned separately); the DSL reference
 * keys are renamed to their wire equivalents:
 * - `allow` → `component_whitelist` (for block-name entries) or
 *   `component_group_whitelist` (for folder entries), plus `restrict_components: true`
 *   and `restrict_type: ''` on `bloks` fields, or `restrict_type: 'groups'` for
 *   folder entries on both `bloks` and `richtext` fields. A bare whitelist is
 *   otherwise ignored by MAPI.
 * - `datasource` → `datasource_slug` (the `source` selector passes through)
 *
 * Every other key (`type`, `pos`, `source`, `required`, validation options, and
 * `type: 'custom'` plugin extras) is preserved verbatim.
 */
export function mapFieldToWire(field: Record<string, unknown>): { name: string; value: Field } {
  const { name, allow, datasource, ...rest } = field;

  const value: Record<string, unknown> = { ...rest };
  if (allow !== undefined && Array.isArray(allow)) {
    const folderPaths = allow
      .filter((entry): entry is { folder: string } => isRecord(entry) && typeof entry.folder === 'string')
      .map(entry => slugifyPath(entry.folder));
    const blockNames = allow.filter(entry => typeof entry === 'string');
    if (folderPaths.length > 0) {
      value.component_group_whitelist = folderPaths;
      if (rest.type === 'bloks' || rest.type === 'richtext') {
        value.restrict_components = true;
        value.restrict_type = 'groups';
      }
    }
    else {
      value.component_whitelist = blockNames;
      if (rest.type === 'bloks') {
        value.restrict_components = true;
        value.restrict_type = '';
      }
    }
  }
  else if (allow !== undefined) {
    value.component_whitelist = allow;
    if (rest.type === 'bloks') {
      value.restrict_components = true;
      value.restrict_type = '';
    }
  }
  if (datasource !== undefined) { value.datasource_slug = datasource; }

  // The wire `Field` is a loose, fully-optional index shape; the structural
  // contract is exercised by the map-to-wire tests rather than the compiler.
  return { name: typeof name === 'string' ? name : '', value: value as Field };
}

/**
 * Maps a content-shape DSL block (the result of `defineBlock`) to a MAPI wire
 * `Component`. The ordered `fields` array becomes a `schema` record keyed by
 * field name (each field keeps its `pos`); the `folder` display path is slugified
 * to a slug path (transient key); everything else passes through.
 */
export function mapBlockToWire(block: Record<string, unknown>): Component {
  const { fields, folder, ...rest } = block;

  const schema: Record<string, Field> = {};
  if (Array.isArray(fields)) {
    for (const field of fields) {
      if (!isRecord(field)) { continue; }
      const { name, value } = mapFieldToWire(field);
      if (name) { schema[name] = value; }
    }
  }

  return {
    ...rest,
    ...(folder !== undefined && { folder: typeof folder === 'string' ? slugifyPath(folder) : null }),
    schema,
  } as unknown as Component;
}

/**
 * Maps a content-shape DSL datasource (the result of `defineDatasource`) to its
 * wire form. The DSL and wire shapes are identical, so this is a passthrough.
 */
export function mapDatasourceToWire(datasource: Record<string, unknown>): Datasource {
  return datasource as unknown as Datasource;
}
