import {
  COMPONENT_STRIP_KEYS,
  DATASOURCE_DIMENSION_STRIP_KEYS,
  DATASOURCE_STRIP_KEYS,
  formatValue,
  stripKeys,
} from './utils';

/** Sorts schema fields by `pos` for stable ordering and strips API-assigned field-level keys. */
function sortSchemaByPos(schema: Record<string, Record<string, unknown>>): Record<string, Record<string, unknown>> {
  const entries = Object.entries(schema)
    .filter(([key]) => key !== '_uid' && key !== 'component')
    .sort(([, a], [, b]) => {
      const posA = typeof a.pos === 'number' ? a.pos : Infinity;
      const posB = typeof b.pos === 'number' ? b.pos : Infinity;
      return posA - posB;
    });
  return Object.fromEntries(
    entries.map(([key, field]) => {
      const { id, ...rest } = field;
      // `restrict_type: ''` is the wire byproduct of a component whitelist (the
      // "restrict by component" mode). MAPI never reads it and omits it on read,
      // and the Visual Editor treats `''` and absent identically — so a value
      // re-derived from the DSL `allow` must not diff against a remote that
      // lacks the key. A non-empty `restrict_type` (`'groups'`/`'tags'`) is real
      // state and is kept.
      if (rest.restrict_type === '') { delete rest.restrict_type; }
      return [key, rest];
    }),
  );
}

/**
 * Serializes a component to a normalized `defineBlock()` code string.
 * Strips API-assigned fields. Uses stable property ordering.
 *
 * `component_group_uuid` is stripped by default (groups are a UI concern), but
 * kept when `includeGroupUuid` is set — used by diffing when a block opts into
 * the group escape hatch, so a changed group is detected and pushed.
 */
export function serializeComponent(
  component: Record<string, unknown>,
  options: { includeGroupUuid?: boolean } = {},
): string {
  const stripSet = options.includeGroupUuid
    ? new Set([...COMPONENT_STRIP_KEYS].filter(key => key !== 'component_group_uuid'))
    : COMPONENT_STRIP_KEYS;
  const clean = stripKeys(component, stripSet);

  if (clean.schema && typeof clean.schema === 'object') {
    clean.schema = sortSchemaByPos(clean.schema as Record<string, Record<string, unknown>>);
  }

  // Enforce property order: name, display_name, is_root, is_nestable, then rest, schema last
  const ordered: Record<string, unknown> = {};
  if (clean.name !== undefined) { ordered.name = clean.name; }
  if (clean.display_name !== undefined) { ordered.display_name = clean.display_name; }
  if (clean.is_root !== undefined) { ordered.is_root = clean.is_root; }
  if (clean.is_nestable !== undefined) { ordered.is_nestable = clean.is_nestable; }

  const handled = new Set(['name', 'display_name', 'is_root', 'is_nestable', 'schema']);
  for (const [key, value] of Object.entries(clean).sort(([a], [b]) => a.localeCompare(b))) {
    if (!handled.has(key)) {
      ordered[key] = value;
    }
  }

  if (clean.schema !== undefined) { ordered.schema = clean.schema; }

  return `defineBlock(${formatValue(ordered, 0)})`;
}

/**
 * Serializes a datasource to a normalized `defineDatasource()` code string.
 */
export function serializeDatasource(datasource: Record<string, unknown>): string {
  const clean = stripKeys(datasource, DATASOURCE_STRIP_KEYS);

  if (Array.isArray(clean.dimensions)) {
    clean.dimensions = clean.dimensions.map((dim: unknown) =>
      typeof dim === 'object' && dim !== null
        ? stripKeys(dim as Record<string, unknown>, DATASOURCE_DIMENSION_STRIP_KEYS)
        : dim,
    );
  }

  const ordered: Record<string, unknown> = {};
  if (clean.name !== undefined) { ordered.name = clean.name; }
  if (clean.slug !== undefined) { ordered.slug = clean.slug; }

  const handled = new Set(['name', 'slug']);
  for (const [key, value] of Object.entries(clean).sort(([a], [b]) => a.localeCompare(b))) {
    if (!handled.has(key)) {
      ordered[key] = value;
    }
  }

  return `defineDatasource(${formatValue(ordered, 0)})`;
}
