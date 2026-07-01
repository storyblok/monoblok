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
 * Sentinel for an explicitly-ungrouped component (`folder: null`). `stripKeys`
 * and `formatValue` both drop null object values, which would erase the
 * distinction between "ungrouped" and "unmanaged" and hide a group-membership
 * diff — so `null` is carried through as this sentinel and rewritten to a
 * literal `null` in the final output.
 */
const FOLDER_UNGROUPED = '__FOLDER_UNGROUPED__';

/**
 * Returns a component reduced to a normalized, stably-ordered object: API-assigned
 * fields stripped, schema fields sorted by `pos`. Shared by
 * {@link serializeComponent} and field-level diffing.
 *
 * `component_group_uuid` is stripped by default (groups are a UI concern), but
 * kept when `includeGroupUuid` is set — used by diffing when a block opts into
 * the group escape hatch, so a changed group is detected and pushed.
 *
 * The transient `folder` key (slug path, or `null` for explicitly ungrouped) is
 * emitted when present so group membership diffs in slug-path space.
 */
export function cleanComponent(
  component: Record<string, unknown>,
  options: { includeGroupUuid?: boolean } = {},
): Record<string, unknown> {
  const stripSet = options.includeGroupUuid
    ? new Set([...COMPONENT_STRIP_KEYS].filter(key => key !== 'component_group_uuid'))
    : COMPONENT_STRIP_KEYS;
  const clean = stripKeys(component, stripSet);

  if (clean.schema && typeof clean.schema === 'object') {
    clean.schema = sortSchemaByPos(clean.schema as Record<string, Record<string, unknown>>);
  }

  // Enforce property order: name, display_name, is_root, is_nestable, folder, then rest, schema last
  const ordered: Record<string, unknown> = {};
  if (clean.name !== undefined) { ordered.name = clean.name; }
  if (clean.display_name !== undefined) { ordered.display_name = clean.display_name; }
  if (clean.is_root !== undefined) { ordered.is_root = clean.is_root; }
  if (clean.is_nestable !== undefined) { ordered.is_nestable = clean.is_nestable; }
  // Read `folder` from the original component: `stripKeys` already dropped a
  // `null` value, so `clean` can't be trusted for it.
  if ('folder' in component) {
    ordered.folder = component.folder === null ? FOLDER_UNGROUPED : component.folder;
  }

  const handled = new Set(['name', 'display_name', 'is_root', 'is_nestable', 'folder', 'schema']);
  for (const [key, value] of Object.entries(clean).sort(([a], [b]) => a.localeCompare(b))) {
    if (!handled.has(key)) {
      ordered[key] = value;
    }
  }

  if (clean.schema !== undefined) { ordered.schema = clean.schema; }

  return ordered;
}

export function serializeComponent(
  component: Record<string, unknown>,
  options: { includeGroupUuid?: boolean } = {},
): string {
  return `defineBlock(${formatValue(cleanComponent(component, options), 0)})`
    .replace(`folder: '${FOLDER_UNGROUPED}'`, 'folder: null');
}

/**
 * Returns a datasource reduced to a normalized, stably-ordered object (API-assigned
 * keys stripped). Shared by {@link serializeDatasource} and field-level diffing.
 */
export function cleanDatasource(datasource: Record<string, unknown>): Record<string, unknown> {
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

  return ordered;
}

/**
 * Serializes a datasource to a normalized `defineDatasource()` code string.
 */
export function serializeDatasource(datasource: Record<string, unknown>): string {
  return `defineDatasource(${formatValue(cleanDatasource(datasource), 0)})`;
}
