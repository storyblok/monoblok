/** Fields to strip from Component before serialization (read-only / API-assigned). */
export const COMPONENT_STRIP_KEYS = new Set([
  'id',
  'created_at',
  'updated_at',
  'real_name', // API-computed display/technical name, read-only
  'preset_id', // Instance-level preset selection, not part of schema definition
  'all_presets', // Computed list of presets, managed via /presets API
  'internal_tags_list', // Read-only expanded form of internal_tag_ids ({id, name} objects)
  'content_type_asset_preview', // Read-only, not in ComponentCreate/ComponentUpdate
  'image', // Read-only preview image URL
  'preview_tmpl', // Read-only preview template
  'metadata', // Not in current API types, stripped defensively
]);

/** Fields to strip from Datasource before serialization. */
export const DATASOURCE_STRIP_KEYS = new Set(['id', 'created_at', 'updated_at']);

/** Fields to strip from Datasource dimension entries before serialization. */
export const DATASOURCE_DIMENSION_STRIP_KEYS = new Set(['id', 'datasource_id', 'created_at', 'updated_at']);

/** Fields to strip from ComponentFolder during pull code generation (keeps uuid for identity). */
export const FOLDER_PULL_STRIP_KEYS = new Set(['id']);

/** Fields to strip from ComponentFolder before serialization for diffing (strips uuid for cross-space portability). */
export const FOLDER_STRIP_KEYS = new Set(['id', 'uuid']);

/**
 * Default values for optional component fields.
 * Applied to both local and remote entities before diffing, and always included in push payloads.
 *
 * Why this is necessary: root-level fields on Storyblok components are ADDITIVE on update —
 * omitting a field from the MAPI update payload preserves the existing value rather than
 * clearing it. So to actually reset a field the user removed from their schema, we must
 * explicitly send the reset value.
 *
 * These defaults are applied to both sides of the diff so that:
 * - No false diff when remote has a default value and local doesn't set the field
 * - Push explicitly resets the field when the user removes it from their schema
 *
 * Excluded intentionally:
 * - `is_root` / `is_nestable`: users set these explicitly; boolean, not nullable
 * - `component_group_uuid`: resetting would silently move component out of its folder
 */
/**
 * Default values for optional datasource fields.
 * Applied to both local and remote entities before diffing to prevent false diffs
 * from auto-populated fields (e.g. MAPI returns `dimensions: []` even when unset).
 */
export const DATASOURCE_DEFAULTS: Record<string, unknown> = {
  dimensions: [],
};

export const COMPONENT_DEFAULTS: Record<string, unknown> = {
  display_name: '',
  color: '',
  icon: '',
  preview_field: '',
  internal_tag_ids: [],
};

/** Injects default values for fields not present (undefined/null) in the entity. */
export function applyDefaults<T extends Record<string, unknown>>(entity: T, defaults: Record<string, unknown>): T {
  const result = { ...entity };
  for (const [key, defaultValue] of Object.entries(defaults)) {
    if (result[key] === undefined || result[key] === null) {
      Object.assign(result, { [key]: defaultValue });
    }
  }
  return result;
}

/** Indentation string (two spaces). */
export const INDENT = '  ';

/**
 * Formats a JavaScript value as a multi-line code string.
 * All object properties are placed on separate lines.
 * Object keys are sorted alphabetically for stable output.
 */
export function formatValue(value: unknown, depth: number): string {
  const indent = INDENT.repeat(depth);
  const innerIndent = INDENT.repeat(depth + 1);

  if (value === null || value === undefined) {
    return String(value);
  }
  if (typeof value === 'string') {
    return `'${value.replace(/'/g, '\\\'')}'`;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[]';
    }
    const items = value.map(item => `${innerIndent}${formatValue(item, depth + 1)},`);
    return `[\n${items.join('\n')}\n${indent}]`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value)
      .filter(([, v]) => v !== undefined && v !== null)
      .sort(([a], [b]) => a.localeCompare(b));
    if (entries.length === 0) {
      return '{}';
    }
    const props = entries.map(
      ([key, val]) => `${innerIndent}${key}: ${formatValue(val, depth + 1)},`,
    );
    return `{\n${props.join('\n')}\n${indent}}`;
  }
  return String(value);
}

/** Strips keys from an object, removing undefined and null values from optional fields. */
export function stripKeys(obj: Record<string, unknown>, keysToStrip: Set<string>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (!keysToStrip.has(key) && value !== undefined && value !== null) {
      result[key] = value;
    }
  }
  return result;
}
