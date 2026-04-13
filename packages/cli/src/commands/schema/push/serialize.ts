import {
  COMPONENT_STRIP_KEYS,
  DATASOURCE_DIMENSION_STRIP_KEYS,
  DATASOURCE_STRIP_KEYS,
  FOLDER_STRIP_KEYS,
  formatValue,
  stripKeys,
} from '../utils';

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
      return [key, rest];
    }),
  );
}

/**
 * Serializes a component to a normalized `defineBlock()` code string.
 * Strips API-assigned fields. Uses stable property ordering.
 */
export function serializeComponent(component: Record<string, unknown>): string {
  const clean = stripKeys(component, COMPONENT_STRIP_KEYS);

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

/**
 * Serializes a component folder to a normalized `defineBlockFolder()` code string.
 */
export function serializeComponentFolder(folder: Record<string, unknown>): string {
  const clean = stripKeys(folder, FOLDER_STRIP_KEYS);

  const ordered: Record<string, unknown> = {};
  if (clean.name !== undefined) { ordered.name = clean.name; }

  const handled = new Set(['name']);
  for (const [key, value] of Object.entries(clean).sort(([a], [b]) => a.localeCompare(b))) {
    if (!handled.has(key)) {
      ordered[key] = value;
    }
  }

  return `defineBlockFolder(${formatValue(ordered, 0)})`;
}
