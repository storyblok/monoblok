import type { Component, Datasource } from '../../../types';
import {
  COMPONENT_STRIP_KEYS,
  DATASOURCE_STRIP_KEYS,
  formatValue,
  INDENT,
  stripKeys,
} from '../utils';

/** Fields to strip from individual schema field entries (`pos` is implicit in array order). */
const FIELD_STRIP_KEYS = new Set(['id', 'pos']);

/**
 * Converts a string to camelCase.
 * Handles snake_case, kebab-case, and space-separated words.
 */
function toCamelCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[\s_-]+(.)/g, (_, char: string) => char.toUpperCase());
}

/**
 * Converts a string to kebab-case.
 * Handles snake_case, camelCase, PascalCase, and space-separated words.
 */
function toKebabCase(str: string): string {
  return str
    .replace(/[\s_]+/g, '-')
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase();
}

/** Returns the variable name for a component. e.g. `'teaser_list'` -> `'teaserListBlock'` */
export function componentVarName(name: string): string {
  return `${toCamelCase(name)}Block`;
}

/** Returns the variable name for a datasource. e.g. `'Categories'` -> `'categoriesDatasource'` */
export function datasourceVarName(name: string): string {
  return `${toCamelCase(name)}Datasource`;
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
 * Reverse of the push-time DSL→wire field mapping: renames the wire reference
 * keys back to their DSL form (`component_whitelist`→`allow`,
 * `datasource_slug`→`datasource`). The `source` selector is left untouched.
 */
function toDslField(field: Record<string, unknown>): Record<string, unknown> {
  const { component_whitelist, datasource_slug, ...rest } = field;
  const out: Record<string, unknown> = { ...rest };
  if (component_whitelist !== undefined) { out.allow = component_whitelist; }
  if (datasource_slug !== undefined) { out.datasource = datasource_slug; }
  return out;
}

/**
 * Generates a `defineField('name', {...})` code string for a single schema field.
 * Position is implicit in the array index, so `pos` is stripped from the config.
 */
function generateFieldCode(fieldName: string, fieldData: Record<string, unknown>, depth: number): string {
  const clean = toDslField(stripKeys(fieldData, FIELD_STRIP_KEYS));
  return `defineField('${fieldName.replace(/'/g, '\\\'')}', ${formatValue(clean, depth + 1)})`;
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
export function generateComponentFile(component: Component): string {
  const lines: string[] = [];

  lines.push('import {');
  lines.push('  defineBlock,');
  lines.push('  defineField,');
  lines.push('} from \'@storyblok/schema\';');
  lines.push('');

  const varName = componentVarName(component.name);
  lines.push(`export const ${varName} = defineBlock({`);

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
export function generateDatasourceFile(datasource: Datasource): string {
  const lines: string[] = [];

  lines.push('import { defineDatasource } from \'@storyblok/schema\';');
  lines.push('');

  const varName = datasourceVarName(datasource.name);
  lines.push(`export const ${varName} = defineDatasource({`);

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
 * alias. Blocks are imported from their group subdirectory (encoded by
 * `groupPathByComponentName`); the schema object exports `{ blocks, datasources }`.
 */
export function generateSchemaFile(
  components: Component[],
  datasources: Datasource[],
  groupPathByComponentName: Map<string, string[]> = new Map(),
): string {
  const lines: string[] = [];

  // Import Schema and Story type helpers
  lines.push('import type { Schema as InferSchema, Story as InferStory } from \'@storyblok/schema\';');
  lines.push('import type { MapiStory as InferStoryMapi } from \'@storyblok/schema\';');
  lines.push('');

  // Import components from their group subdirectory
  for (const component of components) {
    const varName = componentVarName(component.name);
    const fileName = componentFileName(component.name);
    // Blocks are imported from their (slugified) group subdirectory — local
    // organization that mirrors the remote groups; `schema push` ignores it.
    const segments = groupPathByComponentName.get(component.name) ?? [];
    const subPath = segments.length > 0 ? `${segments.join('/')}/` : '';
    lines.push(`import { ${varName} } from './components/${subPath}${fileName}';`);
  }

  // Import datasources
  for (const datasource of datasources) {
    const varName = datasourceVarName(datasource.name);
    const fileName = datasourceFileName(datasource);
    lines.push(`import { ${varName} } from './datasources/${fileName}';`);
  }

  lines.push('');

  // Export schema object
  lines.push('export const schema = {');

  if (components.length > 0) {
    lines.push('  blocks: {');
    for (const component of components) {
      const varName = componentVarName(component.name);
      lines.push(`    ${varName},`);
    }
    lines.push('  },');
  }

  if (datasources.length > 0) {
    lines.push('  datasources: {');
    for (const datasource of datasources) {
      const varName = datasourceVarName(datasource.name);
      lines.push(`    ${varName},`);
    }
    lines.push('  },');
  }

  lines.push('};');
  lines.push('');

  // Schema and Blocks types derived via Schema helper
  lines.push('export type Schema = InferSchema<typeof schema>;');
  lines.push('export type Blocks = Schema[\'blocks\'];');
  lines.push('export type Story = InferStory<Blocks>;');
  lines.push('export type StoryMapi = InferStoryMapi<Blocks>;');
  lines.push('');

  return lines.join('\n');
}
