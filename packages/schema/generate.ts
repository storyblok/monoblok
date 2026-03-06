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

  if (prop.type === 'string') {
    return 'string';
  }
  if (prop.type === 'number' || prop.type === 'integer') {
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
    // Plain object with no defined properties (e.g., additionalProperties: true)
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

  return `{\n${lines.join('\n')}\n}`;
}

/**
 * Extracts an OpenAPI component schema by name from a bundled OpenAPI document.
 */
function extractComponentSchema(doc: OpenApiSchema, schemaName: string): OpenApiSchema | undefined {
  // OpenAPI 3.x
  if (doc.components?.schemas?.[schemaName]) {
    return doc.components.schemas[schemaName];
  }
  // OpenAPI 2.x
  if (doc.definitions?.[schemaName]) {
    return doc.definitions[schemaName];
  }
  return undefined;
}

function renderOutput(context: Pick<TemplateContext, 'schemas' | 'types'> & { emitSchemas?: boolean; emitTypes?: boolean }) {
  const handlebars = getHandlebars();
  const source = readFileSync(templatePath, 'utf8');
  const template = handlebars.compile(source);

  let output = maybePretty(template(context), null);

  // z.lazy() schemas need an explicit type annotation to avoid TS7022
  // ("implicitly has type 'any' because it references itself").
  output = output.replace(
    /export const (\w+) = z\.lazy\(/g,
    'export const $1: z.ZodType = z.lazy(',
  );

  // Fix story_content: the generated z.record() doesn't enforce the required
  // _uid and component fields declared in the OpenAPI spec. Replace with an
  // intersection of z.object() for the required fields and z.record() for the
  // dynamic additional properties.
  output = output.replace(
    /(export const story_content: z\.ZodType = z\.lazy\(\(\) =>\s*)z\.record\(/,
    '$1z.object({\n    _uid: z.string(),\n    component: z.string(),\n    _editable: z.string().optional(),\n  }).and(z.record(',
  );
  // Close the extra .and( paren that wraps z.record()
  output = output.replace(
    /(export const story_content[\s\S]*?z\.record\([\s\S]*?\)\s*)\);/,
    '$1));',
  );

  // .strict().passthrough() is contradictory: .passthrough() overrides
  // .strict(), making the latter a no-op. Remove .strict() where it
  // immediately precedes .passthrough(). The prettifier may insert
  // newlines between the two calls, so we allow optional whitespace.
  output = output.replace(/\.strict\(\)\s*\.passthrough\(\)/g, '.passthrough()');

  // Remove .default() calls on optional enum fields. The OpenAPI `default`
  // is a documentation hint for the server, not a client-side transform.
  // Keeping it causes a type divergence: Zod output becomes non-optional
  // while the TypeScript type stays optional.
  output = output.replace(/\.optional\(\)\.default\([^)]+\)/g, '.optional()');

  // z.discriminatedUnion() requires ZodObject members, but allOf composition
  // in the OpenAPI spec produces ZodIntersection via .and(). Replace with
  // z.union() which accepts any Zod type.
  output = output.replace(
    /z\.discriminatedUnion\("type",/g,
    'z.union(',
  );

  return output;
}

async function main() {
  const openApiPackagePath = getOpenApiPackagePath();
  const specs = [
    { path: resolve(openApiPackagePath, 'dist/mapi/stories.yaml'), name: 'mapi-stories' },
    { path: resolve(openApiPackagePath, 'dist/mapi/components.yaml'), name: 'mapi-components' },
    { path: resolve(openApiPackagePath, 'dist/mapi/datasources.yaml'), name: 'mapi-datasources' },
    { path: resolve(openApiPackagePath, 'dist/mapi/assets.yaml'), name: 'mapi-assets' },
    { path: resolve(openApiPackagePath, 'dist/capi/stories.yaml'), name: 'capi-stories' },
  ];

  rmSync(generatedDir, { recursive: true, force: true });
  mkdirSync(generatedDir, { recursive: true });
  writeFileSync(resolve(generatedDir, '.gitkeep'), '');

  const mergedContext: Pick<TemplateContext, 'schemas' | 'types'> = {
    schemas: {},
    types: {},
  };

  // Store bundled OpenAPI docs for extracting schemas that openapi-zod-client misses.
  const bundledDocs: Array<{ name: string; doc: OpenApiSchema }> = [];

  for (const spec of specs) {
    const openApiDoc = await SwaggerParser.bundle(spec.path);
    bundledDocs.push({ name: spec.name, doc: openApiDoc as OpenApiSchema });
    const context = getZodClientTemplateContext(openApiDoc as Parameters<typeof getZodClientTemplateContext>[0], generatorOptions);

    for (const [name, schema] of Object.entries(context.schemas)) {
      mergedContext.schemas[name] ??= schema;
    }

    for (const [name, type] of Object.entries(context.types)) {
      mergedContext.types[name] ??= type;
    }
  }

  writeFileSync(resolve(generatedDir, 'zod-schemas.ts'), renderOutput({ ...mergedContext, emitSchemas: true }));

  // Schemas that are not referenced by any other schema are invisible to
  // openapi-zod-client's dependency graph and therefore never get TS types.
  // Instead of using z.infer (which carries .passthrough() artifacts that add
  // `& { [k: string]: unknown }` and break structural typing), derive proper
  // TypeScript type alias strings directly from the OpenAPI schema definitions.
  const missingTypeNames = ['Asset', 'Datasource'] as const;

  for (const typeName of missingTypeNames) {
    if (mergedContext.types[typeName]) {
      continue; // Already present
    }

    let schema: OpenApiSchema | undefined;
    for (const { doc } of bundledDocs) {
      schema = extractComponentSchema(doc, typeName);
      if (schema) {
        break;
      }
    }

    if (!schema) {
      throw new Error(`Could not find OpenAPI schema for "${typeName}" in any bundled spec.`);
    }

    const tsBody = schemaObjectToTs(schema);
    mergedContext.types[typeName] = `type ${typeName} = ${tsBody};`;
  }

  const typesOutput = renderOutput({ ...mergedContext, emitTypes: true });
  writeFileSync(resolve(generatedDir, 'types.ts'), typesOutput);
}

main().catch((error) => {
  console.error('Generation failed:', error);
  process.exit(1);
});
