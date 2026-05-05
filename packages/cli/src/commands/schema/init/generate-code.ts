import type { Component, ComponentFolder, Datasource } from '../../../types';
import {
  COMPONENT_STRIP_KEYS,
  DATASOURCE_STRIP_KEYS,
  FOLDER_PULL_STRIP_KEYS,
  formatValue,
  INDENT,
  stripKeys,
} from '../utils';

/** Fields on a schema field entry that belong in the prop config (second arg of defineProp). */
const PROP_CONFIG_KEYS = new Set(['pos', 'required']);

/** Fields to strip from individual schema field entries. */
const FIELD_STRIP_KEYS = new Set(['id']);

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

/** Returns the variable name for a folder. e.g. `'Content Blocks'` -> `'contentBlocksFolder'` */
export function folderVarName(name: string): string {
  return `${toCamelCase(name)}Folder`;
}

/** Returns the variable name for a datasource. e.g. `'Categories'` -> `'categoriesDatasource'` */
export function datasourceVarName(name: string): string {
  return `${toCamelCase(name)}Datasource`;
}

/** Returns the file name (without extension) for a component. e.g. `'teaser_list'` -> `'teaser-list'` */
export function componentFileName(name: string): string {
  return toKebabCase(name);
}

/** Returns the file name (without extension) for a folder. e.g. `'Content Blocks'` -> `'content-blocks'` */
export function folderFileName(name: string): string {
  return toKebabCase(name);
}

/** Returns the file name (without extension) for a datasource, using slug if available. */
export function datasourceFileName(datasource: Pick<Datasource, 'name'> & { slug?: string }): string {
  return toKebabCase(datasource.slug || datasource.name);
}

/**
 * Generates a `defineProp(defineField({...}), {...})` code string for a single schema field.
 * Splits field-level config from prop-level config (pos, required).
 */
function generateFieldCode(fieldData: Record<string, unknown>, depth: number): string {
  const fieldConfig: Record<string, unknown> = {};
  const propConfig: Record<string, unknown> = {};

  const clean = stripKeys(fieldData, FIELD_STRIP_KEYS);

  for (const [key, value] of Object.entries(clean)) {
    if (PROP_CONFIG_KEYS.has(key)) {
      propConfig[key] = value;
    }
    else {
      fieldConfig[key] = value;
    }
  }

  const fieldStr = `defineField(${formatValue(fieldConfig, depth + 1)})`;
  const propStr = formatValue(propConfig, depth + 1);

  return `defineProp(${fieldStr}, ${propStr})`;
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
 * Strips API-assigned fields. Schema fields are sorted by `pos`.
 * When `componentFolders` is provided and `component_group_uuid` matches a folder,
 * the generated code imports the folder and uses `folderVar.uuid` instead of a raw UUID string.
 */
export function generateComponentFile(component: Component, componentFolders?: ComponentFolder[]): string {
  const lines: string[] = [];

  // Resolve folder reference: if component_group_uuid matches a folder, emit a variable reference
  let matchedFolder: ComponentFolder | undefined;
  if (component.component_group_uuid && componentFolders) {
    matchedFolder = componentFolders.find(f => f.uuid === component.component_group_uuid);
  }

  // Import statement
  lines.push('import {');
  lines.push('  defineBlock,');
  lines.push('  defineField,');
  lines.push('  defineProp,');
  lines.push('} from \'@storyblok/schema\';');

  if (matchedFolder) {
    lines.push('');
    const fVarName = folderVarName(matchedFolder.name);
    const fFileName = folderFileName(matchedFolder.name);
    lines.push(`import { ${fVarName} } from './folders/${fFileName}';`);
  }

  lines.push('');

  const varName = componentVarName(component.name);
  lines.push(`export const ${varName} = defineBlock({`);

  // Build ordered properties (excluding schema)
  const clean = stripKeys(component as unknown as Record<string, unknown>, COMPONENT_STRIP_KEYS);

  // Remove component_group_uuid from clean if it will be emitted as a folder reference
  if (matchedFolder) {
    delete clean.component_group_uuid;
  }

  // Enforce property order: name, display_name, is_root, is_nestable, then rest, schema last
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

  // Emit component_group_uuid as folder reference (before other sorted keys)
  if (matchedFolder) {
    const fVarName = folderVarName(matchedFolder.name);
    lines.push(`${INDENT}component_group_uuid: ${fVarName}.uuid,`);
  }

  for (const key of orderedKeys) {
    lines.push(`${INDENT}${key}: ${formatValue(clean[key], 1)},`);
  }

  // Schema fields
  if (clean.schema && typeof clean.schema === 'object') {
    const schema = clean.schema as Record<string, Record<string, unknown>>;
    const sortedFields = sortSchemaByPos(schema);

    if (sortedFields.length > 0) {
      lines.push(`${INDENT}schema: {`);
      for (const [fieldName, fieldData] of sortedFields) {
        const fieldCode = generateFieldCode(fieldData, 2);
        lines.push(`${INDENT}${INDENT}${fieldName}: ${fieldCode},`);
      }
      lines.push(`${INDENT}},`);
    }
    else {
      lines.push(`${INDENT}schema: {},`);
    }
  }

  lines.push('});');
  lines.push('');

  return lines.join('\n');
}

/**
 * Generates a full TypeScript file for a component folder with `defineBlockFolder()`.
 * Strips API-assigned fields (id) but preserves uuid for stable identity.
 */
export function generateFolderFile(folder: ComponentFolder): string {
  const lines: string[] = [];

  lines.push('import { defineBlockFolder } from \'@storyblok/schema/mapi\';');
  lines.push('');

  const varName = folderVarName(folder.name);
  lines.push(`export const ${varName} = defineBlockFolder({`);

  const clean = stripKeys(folder as unknown as Record<string, unknown>, FOLDER_PULL_STRIP_KEYS);

  // Enforce property order: name first, then rest
  if (clean.name !== undefined) {
    lines.push(`${INDENT}name: ${formatValue(clean.name, 1)},`);
  }

  const handled = new Set(['name']);
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
 * Generates a `schema.ts` file that combines the schema object, types, and Story alias.
 * This is the single entry point for a code-driven schema directory.
 */
export function generateSchemaFile(
  components: Component[],
  componentFolders: ComponentFolder[],
  datasources: Datasource[],
): string {
  const lines: string[] = [];

  // Import Schema and Story type helpers
  lines.push('import type { Schema as InferSchema, Story as InferStory } from \'@storyblok/schema\';');
  lines.push('import type { Story as InferStoryMapi } from \'@storyblok/schema/mapi\';');
  lines.push('');

  // Import components
  for (const component of components) {
    const varName = componentVarName(component.name);
    const fileName = componentFileName(component.name);
    lines.push(`import { ${varName} } from './components/${fileName}';`);
  }

  // Import component folders
  for (const folder of componentFolders) {
    const varName = folderVarName(folder.name);
    const fileName = folderFileName(folder.name);
    lines.push(`import { ${varName} } from './components/folders/${fileName}';`);
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

  if (componentFolders.length > 0) {
    lines.push('  blockFolders: {');
    for (const folder of componentFolders) {
      const varName = folderVarName(folder.name);
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
