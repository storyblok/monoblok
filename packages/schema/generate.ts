import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import SwaggerParser from '@apidevtools/swagger-parser';
import { getHandlebars, getZodClientTemplateContext, maybePretty } from 'openapi-zod-client';
import type { TemplateContext } from 'openapi-zod-client';

interface WorkspacePackage {
  path: string;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const generatedDir = resolve(__dirname, 'src/generated');
const templatePath = resolve(__dirname, 'templates/schemas-only.hbs');

const generatorOptions: NonNullable<TemplateContext['options']> = {
  withAlias: false,
  baseUrl: '',
  shouldExportAllSchemas: true,
  shouldExportAllTypes: true,
  withDescription: false,
  strictObjects: true,
};

function getOpenApiPackagePath() {
  const output = execSync('pnpm --filter @storyblok/openapi list --json', { encoding: 'utf8' });
  const packages = JSON.parse(output) as WorkspacePackage[];

  if (packages.length === 0) {
    throw new Error('Could not resolve @storyblok/openapi workspace package.');
  }

  return packages[0].path;
}

type OpenApiSchema = Record<string, any>;

/**
 * Converts an OpenAPI schema property to a TypeScript type string.
 * Handles primitives, arrays, objects, and nested structures.
 */
function schemaPropertyToTs(prop: OpenApiSchema): string {
  if (!prop) {
    return 'unknown';
  }

  // Handle $ref pointers — extract the referenced type name.
  if (prop.$ref && typeof prop.$ref === 'string') {
    const refName = prop.$ref.split('/').pop() ?? 'unknown';
    // Convert kebab-case to PascalCase to match generated TS type names.
    return refName.replace(/(^|-)(\w)/g, (_: string, __: string, c: string) => c.toUpperCase());
  }

  // OpenAPI 3.1: type can be an array e.g. ["string", "null"]
  if (Array.isArray(prop.type)) {
    const nonNull = (prop.type as string[]).filter(t => t !== 'null');
    const nullable = (prop.type as string[]).includes('null');
    const inner = nonNull.map(t => schemaPropertyToTs({ ...prop, type: t })).join(' | ');
    return nullable ? `${inner} | null` : inner;
  }

  if (prop.type === 'string') {
    if (prop.enum) {
      return (prop.enum as string[]).map(v => `"${v}"`).join(' | ');
    }
    return 'string';
  }
  if (prop.type === 'number' || prop.type === 'integer') {
    if (prop.enum) {
      return (prop.enum as number[]).join(' | ');
    }
    return 'number';
  }
  if (prop.type === 'boolean') {
    return 'boolean';
  }

  if (prop.type === 'array') {
    const itemType = prop.items ? schemaPropertyToTs(prop.items) : 'unknown';
    return `Array<${itemType}>`;
  }

  if (prop.type === 'object') {
    if (prop.properties) {
      return schemaObjectToTs(prop);
    }
    if (prop.additionalProperties && typeof prop.additionalProperties === 'object') {
      const valueType = schemaPropertyToTs(prop.additionalProperties);
      return `Record<string, ${valueType}>`;
    }
    if (prop.additionalProperties) {
      return 'Record<string, unknown>';
    }
    return '{}';
  }

  return 'unknown';
}

/**
 * Converts an OpenAPI object schema to a TypeScript type string.
 * Produces a clean structural type without index signatures.
 */
function schemaObjectToTs(schema: OpenApiSchema): string {
  const required = new Set<string>(schema.required || []);
  const props = schema.properties || {};
  const lines: string[] = [];

  for (const [name, prop] of Object.entries<OpenApiSchema>(props)) {
    const tsType = schemaPropertyToTs(prop);
    const isRequired = required.has(name);
    lines.push(`  ${name}${isRequired ? '' : '?'}: ${tsType}${isRequired ? '' : ' | undefined'};`);
  }

  let base = `{\n${lines.join('\n')}\n}`;

  // When additionalProperties is a schema (not just `true`), produce an
  // intersection with a `Record<string, ValueType>` so arbitrary keys are
  // typed correctly.
  if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
    const valueType = schemaPropertyToTs(schema.additionalProperties);
    base = `${base} & Record<string, ${valueType}>`;
  }
  else if (schema.additionalProperties === true) {
    base = `${base} & Record<string, unknown>`;
  }

  return base;
}

/**
 * Extracts an OpenAPI component schema by name from a bundled OpenAPI document.
 */
function extractComponentSchema(doc: OpenApiSchema, schemaName: string): OpenApiSchema | undefined {
  if (doc.components?.schemas?.[schemaName]) {
    return doc.components.schemas[schemaName];
  }
  if (doc.definitions?.[schemaName]) {
    return doc.definitions[schemaName];
  }
  return undefined;
}

function applyOutputFixups(output: string): string {
  // z.lazy() schemas need an explicit type annotation to avoid TS7022
  output = output.replace(
    /export const (\w+) = z\.lazy\(/g,
    'export const $1: z.ZodType = z.lazy(',
  );

  // .strict().passthrough() is contradictory
  output = output.replace(/\.strict\(\)\s*\.passthrough\(\)/g, '.passthrough()');

  // Remove .default() on optional enums
  output = output.replace(/\.optional\(\)\.default\([^)]+\)/g, '.optional()');

  // z.discriminatedUnion() → z.union() for allOf-composed members
  output = output.replace(
    /z\.discriminatedUnion\("type",/g,
    'z.union(',
  );

  // BlokContentInput and BlokContent index signatures need `| undefined` so
  // that TypeScript inline-union objects (which synthesise `prop?: undefined`
  // for missing keys) are assignable.
  output = output.replace(
    /(\[key: string\]:[^}]+)(;[ \t]*\n[ \t]*\})/g,
    (match, valueUnion: string, close: string) =>
      valueUnion.includes('| undefined')
        ? match
        : `${valueUnion}\n    | undefined${close}`,
  );

  return output;
}

// ---------------------------------------------------------------------------
// Name conversion helpers
// ---------------------------------------------------------------------------

/** Convert snake_case to PascalCase. */
function snakeToPascal(name: string): string {
  return name.replace(/(^|_)([a-z])/g, (_, __, c: string) => c.toUpperCase());
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------------------------------------------------------------------------
// Type & schema classification
// ---------------------------------------------------------------------------

/** Names that belong to CAPI + shared types/schemas. */
const CAPI_NAMES = new Set([
  'story_capi',
  'story_base',
  'story_alternate',
  'story_translated_slug',
  'story_localized_path',
  'blok_content',
  'asset_field_value',
  'multilink_field_value',
  'table_field_value',
  'richtext_field_value',
  'plugin_field_value',
  'Datasource',
  // New CAPI entity types (appear in context.types via their kebab-capi aliases)
  'space_capi',
  'link_capi',
  'tag_capi',
  'datasource_entry_capi',
]);

/** Names that belong to MAPI-only types/schemas. */
const MAPI_NAMES = new Set([
  'story_mapi',
  'blok_content_input',
  'story_create',
  'story_update',
  'story_create_request',
  'story_update_request',
  'StoryDuplicateRequest',
  'story_version',
  'UnpublishedStory',
  'ComponentContent',
  'component',
  'component_create',
  'component_update',
  'Component',
  'ComponentCreate',
  'ComponentUpdate',
  'Datasource',
  'DatasourceCreate',
  'DatasourceUpdate',
  'ComponentSchemaField',
  'base_field',
  'value_field',
  'text_field',
  'textarea_field',
  'richtext_field',
  'markdown_field',
  'number_field',
  'datetime_field',
  'boolean_field',
  'option_field',
  'options_field',
  'asset_field',
  'multiasset_field',
  'multilink_field',
  'bloks_field',
  'table_field',
  'section_field',
  'tab_field',
  'custom_field',
  'datasource_create',
  'datasource_update',
  // New MAPI entity and write-payload types (injected via manual extraction below)
  'Asset',
  'AssetCreate',
  'AssetUpdate',
  'AssetFolder',
  'AssetFolderCreate',
  'AssetFolderUpdate',
  'ComponentFolder',
  'ComponentFolderCreate',
  'ComponentFolderUpdate',
  'DatasourceEntry',
  'DatasourceEntryCreate',
  'DatasourceEntryUpdate',
  'InternalTag',
  'InternalTagCreate',
  'InternalTagUpdate',
  'Preset',
  'PresetCreate',
  'PresetUpdate',
  'Space',
  'SpaceCreate',
  'SpaceUpdate',
  'User',
  'UserUpdate',
  'Collaborator',
]);

/**
 * PascalCase aliases in the old output that were `type Foo = bar;` or `const Foo = bar;`.
 * These are redundant now that canonical names are PascalCase.
 */
const TYPE_ALIAS_NAMES = new Set([
  'Story', // was: type Story = story_mapi
  'StoryCreate', // was: type StoryCreate = story_create
  'StoryUpdate', // was: type StoryUpdate = story_update
  'StoryCreateRequest',
  'StoryUpdateRequest',
  'StoryVersion', // was: type StoryVersion = story_version
  'Component', // canonical type comes from `component` key
  'component_create', // openapi-zod-client loses additionalProperties; use MISSING_TYPES instead
  'component_update', // openapi-zod-client loses additionalProperties; use MISSING_TYPES instead
]);

/**
 * Type rename overrides: old name → new PascalCase name.
 * story_capi → Story (in CAPI file), story_mapi → Story (in MAPI file).
 */
const TYPE_RENAME: Record<string, string> = {
  story_capi: 'Story',
  story_mapi: 'Story',
  // New CAPI entity renames (kebab-capi → clean PascalCase)
  space_capi: 'Space',
  link_capi: 'Link',
  tag_capi: 'Tag',
  datasource_entry_capi: 'DatasourceEntry',
};

/** Get the PascalCase type name for an old name. */
function getTypeName(oldName: string): string {
  if (TYPE_RENAME[oldName]) {
    return TYPE_RENAME[oldName];
  }
  if (/^[A-Z]/.test(oldName)) {
    return oldName;
  }
  return snakeToPascal(oldName);
}

/**
 * Rename type references inside a type body string.
 * Only renames known type names that appear in type-reference positions,
 * NOT property names inside object literals.
 *
 * Strategy: replace `\bOLD_NAME\b` only when it appears as a type reference
 * (after `: `, `Array<`, `| `, `& `, `extends `, `= `, or at start of line for export declarations).
 * We do this by matching each known name with appropriate lookahead/lookbehind.
 */
function renameTypeReferences(body: string, renameMap: Map<string, string>): string {
  if (renameMap.size === 0) {
    return body;
  }

  // Sort by length descending to avoid partial matches
  const sorted = [...renameMap.entries()].sort((a, b) => b[0].length - a[0].length);

  for (const [oldName, newName] of sorted) {
    // Match the old name when preceded by a type-reference context character/pattern.
    // This avoids matching property names like `component:` in object literals.
    // Contexts where a type name can appear:
    //   - After `= ` (type alias RHS)
    //   - After `: ` (but NOT as a property key before `:`)
    //   - After `| ` or `& ` (union/intersection)
    //   - After `Array<` or generic `<`
    //   - After `extends `
    //   - After `Partial<`, `Omit<`, etc.
    //   - Standalone on its own line (rare)
    //
    // The simplest robust approach: match `\bOLD_NAME\b` when NOT immediately
    // followed by `:` (which would mean it's a property key).
    // Also, don't match inside string literals (between quotes).
    const regex = new RegExp(
      `\\b${escapeRegex(oldName)}\\b(?!["']|\\s*:(?!:))`,
      'g',
    );
    body = body.replace(regex, newName);
  }

  return body;
}

// ---------------------------------------------------------------------------
// Main rendering
// ---------------------------------------------------------------------------

function renderRaw(context: Pick<TemplateContext, 'schemas' | 'types'>, emit: 'schemas' | 'types'): string {
  const handlebars = getHandlebars();
  const source = readFileSync(templatePath, 'utf8');
  const template = handlebars.compile(source);

  const rendered = maybePretty(
    template({
      ...context,
      emitSchemas: emit === 'schemas',
      emitTypes: emit === 'types',
    }),
    null,
  );

  return applyOutputFixups(rendered);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const openApiPackagePath = getOpenApiPackagePath();
  const specs = [
    // MAPI
    { path: resolve(openApiPackagePath, 'dist/mapi/stories.yaml'), name: 'mapi-stories' },
    { path: resolve(openApiPackagePath, 'dist/mapi/components.yaml'), name: 'mapi-components' },
    { path: resolve(openApiPackagePath, 'dist/mapi/datasources.yaml'), name: 'mapi-datasources' },
    { path: resolve(openApiPackagePath, 'dist/mapi/assets.yaml'), name: 'mapi-assets' },
    { path: resolve(openApiPackagePath, 'dist/mapi/asset_folders.yaml'), name: 'mapi-asset-folders' },
    { path: resolve(openApiPackagePath, 'dist/mapi/component_folders.yaml'), name: 'mapi-component-folders' },
    { path: resolve(openApiPackagePath, 'dist/mapi/datasource_entries.yaml'), name: 'mapi-datasource-entries' },
    { path: resolve(openApiPackagePath, 'dist/mapi/internal_tags.yaml'), name: 'mapi-internal-tags' },
    { path: resolve(openApiPackagePath, 'dist/mapi/presets.yaml'), name: 'mapi-presets' },
    { path: resolve(openApiPackagePath, 'dist/mapi/spaces.yaml'), name: 'mapi-spaces' },
    { path: resolve(openApiPackagePath, 'dist/mapi/users.yaml'), name: 'mapi-users' },
    // CAPI
    { path: resolve(openApiPackagePath, 'dist/capi/stories.yaml'), name: 'capi-stories' },
    { path: resolve(openApiPackagePath, 'dist/capi/datasource_entries.yaml'), name: 'capi-datasource-entries' },
    { path: resolve(openApiPackagePath, 'dist/capi/links.yaml'), name: 'capi-links' },
    { path: resolve(openApiPackagePath, 'dist/capi/spaces.yaml'), name: 'capi-spaces' },
    { path: resolve(openApiPackagePath, 'dist/capi/tags.yaml'), name: 'capi-tags' },
  ];

  rmSync(generatedDir, { recursive: true, force: true });
  mkdirSync(generatedDir, { recursive: true });
  writeFileSync(resolve(generatedDir, '.gitkeep'), '');

  const mergedContext: Pick<TemplateContext, 'schemas' | 'types'> = {
    schemas: {},
    types: {},
  };

  const bundledDocs: Array<{ name: string; doc: OpenApiSchema }> = [];

  for (const spec of specs) {
    const openApiDoc = await SwaggerParser.bundle(spec.path);
    bundledDocs.push({ name: spec.name, doc: openApiDoc as OpenApiSchema });
    const context = getZodClientTemplateContext(
      openApiDoc as Parameters<typeof getZodClientTemplateContext>[0],
      generatorOptions,
    );

    for (const [name, schema] of Object.entries(context.schemas)) {
      mergedContext.schemas[name] ??= schema;
    }
    for (const [name, type] of Object.entries(context.types)) {
      mergedContext.types[name] ??= type;
    }
  }

  // -------------------------------------------------------------------------
  // Add missing types (unreferenced or schema-only entries that openapi-zod-client skips)
  //
  // Maps desired TypeScript type name → the schema component name in the spec.
  // Kebab-case schema names (e.g. 'asset-folder-create') are used as-is for lookup
  // since the bundled dist preserves the original component names.
  // -------------------------------------------------------------------------
  const MISSING_TYPES: Array<{ typeName: string; schemaName: string }> = [
    // MAPI Asset — no standalone CAPI Asset endpoint exists; CDN users use AssetFieldValue.
    { typeName: 'Asset', schemaName: 'Asset' },
    { typeName: 'Datasource', schemaName: 'Datasource' },
    // MAPI datasource types (in context.schemas, not context.types)
    { typeName: 'DatasourceCreate', schemaName: 'datasource-create' },
    { typeName: 'DatasourceUpdate', schemaName: 'datasource-update' },
    // MAPI Space (override to inline Collaborator reference)
    { typeName: 'Space', schemaName: 'Space' },
    // MAPI entity read types
    { typeName: 'AssetFolder', schemaName: 'AssetFolder' },
    { typeName: 'ComponentFolder', schemaName: 'ComponentFolder' },
    { typeName: 'DatasourceEntry', schemaName: 'DatasourceEntry' },
    { typeName: 'InternalTag', schemaName: 'InternalTag' },
    { typeName: 'Preset', schemaName: 'Preset' },
    { typeName: 'User', schemaName: 'User' },
    // MAPI write-payload types (kebab-case schema names → PascalCase type names)
    { typeName: 'AssetCreate', schemaName: 'asset-create' },
    { typeName: 'AssetUpdate', schemaName: 'AssetUpdate' },
    { typeName: 'AssetFolderCreate', schemaName: 'asset-folder-create' },
    { typeName: 'AssetFolderUpdate', schemaName: 'asset-folder-update' },
    { typeName: 'ComponentFolderCreate', schemaName: 'component-folder-create' },
    { typeName: 'ComponentFolderUpdate', schemaName: 'component-folder-update' },
    { typeName: 'DatasourceEntryCreate', schemaName: 'datasource-entry-create' },
    { typeName: 'DatasourceEntryUpdate', schemaName: 'datasource-entry-update' },
    { typeName: 'InternalTagCreate', schemaName: 'internal-tag-create' },
    { typeName: 'InternalTagUpdate', schemaName: 'internal-tag-update' },
    { typeName: 'PresetCreate', schemaName: 'preset-create' },
    { typeName: 'PresetUpdate', schemaName: 'preset-update' },
    { typeName: 'SpaceCreate', schemaName: 'space-create' },
    { typeName: 'SpaceUpdate', schemaName: 'space-update' },
    { typeName: 'UserUpdate', schemaName: 'user-update' },
    { typeName: 'Collaborator', schemaName: 'Collaborator' },
    // ComponentCreate/ComponentUpdate: openapi-zod-client generates schema as {} (loses additionalProperties)
    { typeName: 'ComponentCreate', schemaName: 'component-create' },
    { typeName: 'ComponentUpdate', schemaName: 'component-update' },
  ];

  for (const { typeName, schemaName } of MISSING_TYPES) {
    // For MAPI types, always override — a CAPI alias with the same name may have
    // been written first (e.g. `type DatasourceEntry = datasource_entry_capi`).
    const isMapi = MAPI_NAMES.has(typeName);
    if (mergedContext.types[typeName] && !isMapi) {
      continue;
    }

    let schema: OpenApiSchema | undefined;
    for (const { doc } of bundledDocs) {
      schema = extractComponentSchema(doc, schemaName);
      if (schema) {
        break;
      }
    }
    if (!schema) {
      throw new Error(`Could not find OpenAPI schema for "${schemaName}" (type: "${typeName}") in any bundled spec.`);
    }

    const tsBody = schemaObjectToTs(schema);
    mergedContext.types[typeName] = `type ${typeName} = ${tsBody};`;
  }

  // -------------------------------------------------------------------------
  // Build rename maps (old name → new name) for references inside bodies
  // -------------------------------------------------------------------------
  const allNames = new Set([...CAPI_NAMES, ...MAPI_NAMES]);

  const typeRenameMap = new Map<string, string>();
  for (const name of allNames) {
    const newName = getTypeName(name);
    if (newName !== name) {
      typeRenameMap.set(name, newName);
    }
  }

  // -------------------------------------------------------------------------
  // Process types: rename, split, and categorize
  // -------------------------------------------------------------------------
  const capiTypes: Array<{ name: string; body: string }> = [];
  const mapiTypes: Array<{ name: string; body: string }> = [];

  for (const [oldName, rawBody] of Object.entries(mergedContext.types)) {
    // Skip pure aliases
    if (TYPE_ALIAS_NAMES.has(oldName)) {
      continue;
    }

    const newName = getTypeName(oldName);

    // Render the type body through the template
    const rendered = renderRaw(
      { schemas: {}, types: { [oldName]: rawBody } },
      'types',
    ).trim();

    // Rename the declaration and all references
    let body = rendered;
    // Rename the declaration itself: `export type OLD_NAME` → `export type NEW_NAME`
    if (oldName !== newName) {
      body = body.replace(
        new RegExp(`\\bexport type ${escapeRegex(oldName)}\\b`),
        `export type ${newName}`,
      );
    }
    // Rename references to other types
    body = renameTypeReferences(body, typeRenameMap);

    if (CAPI_NAMES.has(oldName)) {
      capiTypes.push({ name: newName, body });
    }
    if (MAPI_NAMES.has(oldName)) {
      mapiTypes.push({ name: newName, body });
    }
  }

  // -------------------------------------------------------------------------
  // Strip per-item "// Auto-generated" headers from bodies
  // (Each renderRaw call adds the template header; we only want it once per file.)
  // -------------------------------------------------------------------------
  const stripHeader = (body: string) => body.replace(/^\/\/ Auto-generated\. Do not edit manually\.\n\n?/gm, '').trim();
  for (const t of capiTypes) {
    t.body = stripHeader(t.body);
  }
  for (const t of mapiTypes) {
    t.body = stripHeader(t.body);
  }
  // -------------------------------------------------------------------------
  // Determine cross-file imports
  // Exclude names that the MAPI file itself exports (to avoid self-imports).
  // -------------------------------------------------------------------------
  const capiTypeNameSet = new Set(capiTypes.map(t => t.name));
  const mapiTypeNameSet = new Set(mapiTypes.map(t => t.name));
  const mapiTypeBodies = mapiTypes.map(t => t.body).join('\n');
  const mapiTypeImports: string[] = [];
  for (const name of capiTypeNameSet) {
    // Skip if MAPI exports its own type with this name
    if (mapiTypeNameSet.has(name)) {
      continue;
    }
    if (new RegExp(`\\b${escapeRegex(name)}\\b`).test(mapiTypeBodies)) {
      mapiTypeImports.push(name);
    }
  }

  // -------------------------------------------------------------------------
  // Write output files
  // -------------------------------------------------------------------------
  const header = '// Auto-generated. Do not edit manually.\n';

  // types.ts (CAPI + shared)
  writeFileSync(
    resolve(generatedDir, 'types.ts'),
    `${header}\n${capiTypes.map(t => t.body).join('\n\n')}\n`,
  );

  // mapi-types.ts (MAPI-only)
  const mapiTypeImportLine = mapiTypeImports.length > 0
    ? `\nimport type { ${mapiTypeImports.sort().join(', ')} } from './types';\n`
    : '';
  writeFileSync(
    resolve(generatedDir, 'mapi-types.ts'),
    `${header}${mapiTypeImportLine}\n${mapiTypes.map(t => t.body).join('\n\n')}\n`,
  );
}

main().catch((error) => {
  console.error('Generation failed:', error);
  process.exit(1);
});
