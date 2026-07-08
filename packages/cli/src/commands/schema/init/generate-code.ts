import type { Component, Datasource } from '../../../types';
import { slugify } from '../../../utils/format';
import {
  COMPONENT_STRIP_KEYS,
  DATASOURCE_STRIP_KEYS,
  formatValue,
  INDENT,
  quoteString,
  stripKeys,
} from '../utils';

/** Fields to strip from individual schema field entries (`pos` is implicit in array order). */
const FIELD_STRIP_KEYS = new Set(['id', 'pos']);

/**
 * Converts an arbitrary name into a valid camelCase JS identifier.
 * `slugify` reduces the input to `[a-z0-9_-]` (symbols stripped, spaces → `-`);
 * we then camelCase across `_`/`-` runs and guard against an empty or
 * leading-digit result so the output is always usable as an identifier.
 */
function toCamelCaseIdentifier(str: string): string {
  const camel = slugify(str)
    .replace(/^[_-]+/, '')
    .replace(/[_-]+(.)/g, (_, char: string) => char.toUpperCase());
  if (!camel) { return '_'; }
  return /^\d/.test(camel) ? `_${camel}` : camel;
}

/**
 * Converts a string to kebab-case, keeping only filesystem/shell-safe
 * characters. Handles snake_case, camelCase, PascalCase, and space-separated
 * words; any remaining non-`[a-z0-9-]` characters collapse to a single `-`.
 */
function toKebabCase(str: string): string {
  return str
    .replace(/[\s_]+/g, '-')
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Returns the variable name for a component. e.g. `'teaser_list'` -> `'teaserListBlock'` */
export function componentVarName(name: string): string {
  return `${toCamelCaseIdentifier(name)}Block`;
}

/** Returns the variable name for a datasource. e.g. `'Categories'` -> `'categoriesDatasource'` */
export function datasourceVarName(name: string): string {
  return `${toCamelCaseIdentifier(name)}Datasource`;
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

/** Returns the file name (without extension) for a datasource, using slug if available. */
export function datasourceFileName(datasource: Pick<Datasource, 'name'> & { slug?: string }): string {
  return toKebabCase(datasource.slug || datasource.name);
}

/**
 * A component paired with the identifiers derived for it: a unique `export`
 * variable name, a unique file name (deduped within its group directory), and
 * the group-path `segments` that place its file. Resolved once so the written
 * file path and the `schema.ts` import path are the same value by construction.
 */
export interface ResolvedComponent {
  component: Component;
  varName: string;
  fileName: string;
  segments: string[];
}

/** A datasource paired with its unique variable name and (flat) file name. */
export interface ResolvedDatasource {
  datasource: Datasource;
  varName: string;
  fileName: string;
}

/**
 * Resolves each component to its unique variable and file names.
 * `segmentsByIndex` gives the group-path directory segments per component
 * (index-aligned to `components`); file-name uniqueness is scoped to that
 * directory, so identically-named blocks in different groups keep their name.
 */
export function resolveComponents(components: Component[], segmentsByIndex: string[][]): ResolvedComponent[] {
  const varNames = resolveVarNames(components.map(c => c.name), componentVarName);
  const fileNames = resolveFileNames(
    components.map(c => componentFileName(c.name)),
    segmentsByIndex.map(segments => segments.join('/')),
  );
  return components.map((component, i) => ({
    component,
    varName: varNames[i],
    fileName: fileNames[i],
    segments: segmentsByIndex[i],
  }));
}

/** Resolves each datasource to its unique variable and file names (flat layout). */
export function resolveDatasources(datasources: Datasource[]): ResolvedDatasource[] {
  const varNames = resolveVarNames(datasources.map(d => d.name), datasourceVarName);
  const fileNames = resolveFileNames(datasources.map(d => datasourceFileName(d)));
  return datasources.map((datasource, i) => ({
    datasource,
    varName: varNames[i],
    fileName: fileNames[i],
  }));
}

/**
 * Reverse of the push-time DSL→wire field mapping: renames the wire reference
 * keys back to their DSL form (`component_whitelist`→`allow`,
 * `datasource_slug`→`datasource`). The `source` selector is left untouched.
 *
 * `restrict_components: true` and `restrict_type: ''` are dropped alongside a
 * `component_whitelist` — they're the wire byproduct `defineField`'s `allow`
 * re-derives on push, not independent DSL state.
 */
function toDslField(field: Record<string, unknown>): Record<string, unknown> {
  const { component_whitelist, datasource_slug, restrict_components, restrict_type, ...rest } = field;
  const out: Record<string, unknown> = { ...rest };
  if (component_whitelist !== undefined) {
    out.allow = component_whitelist;
  }
  else {
    if (restrict_components !== undefined) { out.restrict_components = restrict_components; }
    if (restrict_type !== undefined) { out.restrict_type = restrict_type; }
  }
  if (datasource_slug !== undefined) { out.datasource = datasource_slug; }
  return out;
}

/**
 * Generates a `defineField('name', {...})` code string for a single schema field.
 * Position is implicit in the array index, so `pos` is stripped from the config.
 */
function generateFieldCode(fieldName: string, fieldData: Record<string, unknown>, depth: number): string {
  const clean = toDslField(stripKeys(fieldData, FIELD_STRIP_KEYS));
  return `defineField(${quoteString(fieldName)}, ${formatValue(clean, depth)})`;
}

/** Sorts schema fields by `pos` for stable ordering. */
function sortSchemaByPos(schema: Record<string, Record<string, unknown>>): [string, Record<string, unknown>][] {
  return Object.entries(schema)
    .filter(([key]) => key !== '_uid' && key !== 'component')
    .sort(([, a], [, b]) => {
      const posA = typeof a.pos === 'number' ? a.pos : Infinity;
      const posB = typeof b.pos === 'number' ? b.pos : Infinity;
      return posA - posB;
    });
}

/**
 * Generates a full TypeScript file for a component with `defineBlock()`.
 *
 * Strips API-assigned fields; schema fields become an ordered `fields:` array of
 * `defineField()` calls (sorted by `pos`). `component_group_uuid` is dropped —
 * groups are a UI concern and aren't part of a content-shape definition.
 */
export function generateComponentFile(component: Component, varName?: string): string {
  const lines: string[] = [];

  lines.push('import {');
  lines.push('  defineBlock,');
  lines.push('  defineField,');
  lines.push('} from \'@storyblok/schema\';');
  lines.push('');

  const resolvedVarName = varName ?? componentVarName(component.name);
  lines.push(`export const ${resolvedVarName} = defineBlock({`);

  const clean = stripKeys(component as unknown as Record<string, unknown>, COMPONENT_STRIP_KEYS);

  // The group is encoded by the directory layout, never emitted on the block.
  delete clean.component_group_uuid;

  // Enforce property order: name, display_name, is_root, is_nestable, then rest, fields last
  const orderedKeys: string[] = [];
  if (clean.name !== undefined) { orderedKeys.push('name'); }
  if (clean.display_name !== undefined) { orderedKeys.push('display_name'); }
  if (clean.is_root !== undefined) { orderedKeys.push('is_root'); }
  if (clean.is_nestable !== undefined) { orderedKeys.push('is_nestable'); }

  const handled = new Set(['name', 'display_name', 'is_root', 'is_nestable', 'schema']);
  for (const key of Object.keys(clean).sort()) {
    if (!handled.has(key)) {
      orderedKeys.push(key);
    }
  }

  for (const key of orderedKeys) {
    lines.push(`${INDENT}${key}: ${formatValue(clean[key], 1)},`);
  }

  // Schema fields — emitted as an ordered `fields:` array of `defineField('name', {...})` calls.
  if (clean.schema && typeof clean.schema === 'object') {
    const schema = clean.schema as Record<string, Record<string, unknown>>;
    const sortedFields = sortSchemaByPos(schema);

    if (sortedFields.length > 0) {
      lines.push(`${INDENT}fields: [`);
      for (const [fieldName, fieldData] of sortedFields) {
        const fieldCode = generateFieldCode(fieldName, fieldData, 2);
        lines.push(`${INDENT}${INDENT}${fieldCode},`);
      }
      lines.push(`${INDENT}],`);
    }
    else {
      lines.push(`${INDENT}fields: [],`);
    }
  }

  lines.push('});');
  lines.push('');

  return lines.join('\n');
}

/**
 * Generates a full TypeScript file for a datasource with `defineDatasource()`.
 * Strips API-assigned fields (id, created_at, updated_at).
 */
export function generateDatasourceFile(datasource: Datasource, varName?: string): string {
  const lines: string[] = [];

  lines.push('import { defineDatasource } from \'@storyblok/schema\';');
  lines.push('');

  const resolvedVarName = varName ?? datasourceVarName(datasource.name);
  lines.push(`export const ${resolvedVarName} = defineDatasource({`);

  const clean = stripKeys(datasource as unknown as Record<string, unknown>, DATASOURCE_STRIP_KEYS);

  // Enforce property order: name, slug, then rest
  if (clean.name !== undefined) {
    lines.push(`${INDENT}name: ${formatValue(clean.name, 1)},`);
  }
  if (clean.slug !== undefined) {
    lines.push(`${INDENT}slug: ${formatValue(clean.slug, 1)},`);
  }

  const handled = new Set(['name', 'slug']);
  for (const [key, value] of Object.entries(clean).sort(([a], [b]) => a.localeCompare(b))) {
    if (!handled.has(key)) {
      lines.push(`${INDENT}${key}: ${formatValue(value, 1)},`);
    }
  }

  lines.push('});');
  lines.push('');

  return lines.join('\n');
}

/**
 * Generates a `schema.ts` file that combines the schema object, types, and Story
 * alias. Blocks are imported from their group subdirectory (via each resolved
 * component's `segments`); the schema object exports `{ blocks, datasources }`.
 */
export function generateSchemaFile(
  components: ResolvedComponent[],
  datasources: ResolvedDatasource[],
): string {
  const lines: string[] = [];

  // Import the defineSchema helper and the Schema/Story type helpers
  lines.push('import { defineSchema } from \'@storyblok/schema\';');
  lines.push('import type { Schema as InferSchema, Story as InferStory } from \'@storyblok/schema\';');
  lines.push('import type { MapiStory as InferStoryMapi } from \'@storyblok/schema\';');
  lines.push('');

  // Import blocks from their (slugified) group subdirectory — local
  // organization that mirrors the remote groups; `schema push` ignores it.
  for (const { varName, fileName, segments } of components) {
    const subPath = segments.length > 0 ? `${segments.join('/')}/` : '';
    lines.push(`import { ${varName} } from './blocks/${subPath}${fileName}';`);
  }

  // Import datasources
  for (const { varName, fileName } of datasources) {
    lines.push(`import { ${varName} } from './datasources/${fileName}';`);
  }

  lines.push('');

  // Export schema object
  lines.push('export const schema = defineSchema({');

  if (components.length > 0) {
    lines.push('  blocks: {');
    for (const { varName } of components) {
      lines.push(`    ${varName},`);
    }
    lines.push('  },');
  }

  if (datasources.length > 0) {
    lines.push('  datasources: {');
    for (const { varName } of datasources) {
      lines.push(`    ${varName},`);
    }
    lines.push('  },');
  }

  lines.push('});');
  lines.push('');

  // Schema and Blocks types derived via Schema helper
  lines.push('export type Schema = InferSchema<typeof schema>;');
  lines.push('export type Blocks = Schema[\'blocks\'];');
  lines.push('export type Story = InferStory<Blocks>;');
  lines.push('export type StoryMapi = InferStoryMapi<Blocks>;');
  lines.push('');

  return lines.join('\n');
}
