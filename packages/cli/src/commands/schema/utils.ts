import { isAbsolute, relative } from "pathe";

// Re-exported so the schema command tree keeps a single util import; the shared
// definition lives in `src/utils/object.ts`.
export { isRecord } from "../../utils/object";

/** Fields to strip from Component before serialization (read-only / API-assigned). */
export const COMPONENT_STRIP_KEYS = new Set([
  "id",
  "created_at",
  "updated_at",
  "real_name", // API-computed display/technical name, read-only
  "preset_id", // Instance-level preset selection, not part of schema definition
  "all_presets", // Computed list of presets, managed via /presets API
  "internal_tags_list", // Read-only expanded form of internal_tag_ids ({id, name} objects)
  "content_type_asset_preview", // Read-only, not in ComponentCreate/ComponentUpdate
  "image", // Read-only preview image URL
  "preview_tmpl", // Read-only preview template
  "metadata", // Not in current API types, stripped defensively
  "component_group_uuid", // UI grouping; stripped by default — kept for diffing only when a block opts into the group escape hatch
]);

/** Fields to strip from Datasource before serialization. */
export const DATASOURCE_STRIP_KEYS = new Set(["id", "created_at", "updated_at"]);

/** Fields to strip from Datasource dimension entries before serialization. */
export const DATASOURCE_DIMENSION_STRIP_KEYS = new Set([
  "id",
  "datasource_id",
  "created_at",
  "updated_at",
]);

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
 * - `component_group_uuid`: stripped before diffing (see COMPONENT_STRIP_KEYS)
 *   unless a block opts into the group escape hatch by setting it explicitly;
 *   diffing then keeps it on both sides so a changed group is pushed
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
  display_name: "",
  description: "",
  color: "",
  icon: "",
  preview_field: "",
  internal_tag_ids: [],
};

/** Injects default values for fields not present (undefined/null) in the entity. */
export function applyDefaults<T extends Record<string, unknown>>(
  entity: T,
  defaults: Record<string, unknown>,
): T {
  const result = { ...entity };
  for (const [key, defaultValue] of Object.entries(defaults)) {
    if (result[key] === undefined || result[key] === null) {
      Object.assign(result, { [key]: defaultValue });
    }
  }
  return result;
}

/** Indentation string (two spaces). */
export const INDENT = "  ";

/**
 * Wraps a string so {@link formatValue} emits it verbatim (unquoted) instead of
 * as a string literal. Used by code generation to place a bare identifier (e.g.
 * an imported `defineFolder` ref) inside an otherwise data-shaped value.
 */
export class RawCode {
  constructor(public readonly code: string) {}
}

/**
 * Serializes a string as a single-quoted TS literal with correct escaping.
 * Uses JSON.stringify for backslash/control-char/newline handling, then converts
 * the double-quoted result to single-quoted output. Without this, backslashes in
 * values like regexes are silently dropped and raw newlines break the parse.
 */
export function quoteString(value: string): string {
  const escaped = JSON.stringify(value)
    .slice(1, -1) // strip the surrounding double quotes
    .replace(/\\"/g, '"') // JSON-escaped `\"` → `"` (no need to escape " inside '...')
    .replace(/'/g, "\\'"); // escape single quotes for the '...' delimiter
  return `'${escaped}'`;
}

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
  if (value instanceof RawCode) {
    return value.code;
  }
  if (typeof value === "string") {
    return quoteString(value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "[]";
    }
    const items = value.map((item) => `${innerIndent}${formatValue(item, depth + 1)},`);
    return `[\n${items.join("\n")}\n${indent}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value)
      .filter(([, v]) => v !== undefined && v !== null)
      .sort(([a], [b]) => a.localeCompare(b));
    if (entries.length === 0) {
      return "{}";
    }
    const props = entries.map(
      ([key, val]) => `${innerIndent}${key}: ${formatValue(val, depth + 1)},`,
    );
    return `{\n${props.join("\n")}\n${indent}}`;
  }
  return String(value);
}

/** Converts an ISO timestamp to a compact filesystem-safe form: `YYYYMMDDHHmmss` (e.g. `20260430114254`). */
export function fileTimestamp(iso: string): string {
  return iso.replace(/\D/g, "").slice(0, 14);
}

/**
 * Formats a file path for display: relative to CWD, unless the user explicitly
 * passed an absolute `--path` (then the absolute path is kept as-is).
 */
export function displayPath(filePath: string, userPath?: string): string {
  return userPath && isAbsolute(userPath) ? filePath : relative(process.cwd(), filePath);
}

/** Strips keys from an object, removing undefined and null values from optional fields. */
export function stripKeys(
  obj: Record<string, unknown>,
  keysToStrip: Set<string>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (!keysToStrip.has(key) && value !== undefined && value !== null) {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Converts a string to kebab-case, keeping only filesystem/shell-safe
 * characters. Handles snake_case, camelCase, PascalCase, and space-separated
 * words; any remaining non-`[a-z0-9-]` characters collapse to a single `-`.
 */
export function toKebabCase(str: string): string {
  return str
    .replace(/[\s_]+/g, '-')
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Guards a generated name against the two shapes that are not valid JS/TS
 * identifiers: empty, and starting with a digit. Storyblok accepts component
 * names like `2_col`, whose camelCase/PascalCase form would otherwise be emitted
 * as a bare `2Col` and make the whole generated file a syntax error. Prefixing
 * `_` keeps the name readable and collision-free (`_2Col`).
 *
 * Apply this to the *finished* identifier, after any fixed suffix is appended:
 * `Foo` + `BlockDefinition` needs no guard, but a leading digit still does.
 */
export function toSafeIdentifier(identifier: string): string {
  if (!identifier) { return '_'; }
  return /^\d/.test(identifier) ? `_${identifier}` : identifier;
}

/**
 * Resolves an ordered list of raw names to unique variable names. Names that
 * sanitize to the same identifier get a numeric suffix (`…2`, `…3`), so the
 * generated `export const`s and schema-object keys never collide. Index-aligned
 * to `rawNames`.
 */
export function resolveVarNames(rawNames: string[], baseVarName: (name: string) => string): string[] {
  const used = new Set<string>();
  return rawNames.map((raw) => {
    const base = baseVarName(raw);
    let candidate = base;
    let n = 2;
    while (used.has(candidate)) { candidate = `${base}${n++}`; }
    used.add(candidate);
    return candidate;
  });
}

/**
 * Resolves an ordered list of already-sanitized base file names to unique ones.
 * `toKebabCase` is lossy (it collapses `_`/`-` runs and strips symbols), so two
 * distinct source names can produce the same file name even though the raw names
 * are unique. Collisions get a `-2`, `-3`, … suffix so generated files never
 * overwrite each other and each `schema.ts` import resolves unambiguously.
 *
 * `dirKeys` scopes uniqueness per directory: blocks live in their group
 * subdirectory, so two blocks with the same file name in *different* group
 * directories don't collide on disk and must keep their shared name. Pass the
 * containing directory (e.g. the joined group path) per index; omit for a flat
 * layout (datasources). Index-aligned to `baseNames`.
 */
export function resolveFileNames(baseNames: string[], dirKeys?: string[]): string[] {
  const usedByDir = new Map<string, Set<string>>();
  return baseNames.map((base, i) => {
    const dir = dirKeys?.[i] ?? '';
    let used = usedByDir.get(dir);
    if (!used) { used = new Set<string>(); usedByDir.set(dir, used); }
    let candidate = base;
    let n = 2;
    while (used.has(candidate)) { candidate = `${base}-${n++}`; }
    used.add(candidate);
    return candidate;
  });
}

/** Returns the file name (without extension) for a component. e.g. `'teaser_list'` -> `'teaser-list'` */
export function componentFileName(name: string): string {
  return toKebabCase(name);
}

/** Sorts schema fields by `pos` for stable ordering. */
export function sortSchemaByPos(schema: Record<string, Record<string, unknown>>): [string, Record<string, unknown>][] {
  return Object.entries(schema)
    .filter(([key]) => key !== '_uid' && key !== 'component')
    .sort(([, a], [, b]) => {
      const posA = typeof a.pos === 'number' ? a.pos : Infinity;
      const posB = typeof b.pos === 'number' ? b.pos : Infinity;
      return posA - posB;
    });
}
