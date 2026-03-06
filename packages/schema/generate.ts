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

  for (const spec of specs) {
    const openApiDoc = await SwaggerParser.bundle(spec.path);
    const context = getZodClientTemplateContext(openApiDoc as Parameters<typeof getZodClientTemplateContext>[0], generatorOptions);

    for (const [name, schema] of Object.entries(context.schemas)) {
      mergedContext.schemas[name] ??= schema;
    }

    for (const [name, type] of Object.entries(context.types)) {
      mergedContext.types[name] ??= type;
    }
  }

  writeFileSync(resolve(generatedDir, 'zod-schemas.ts'), renderOutput({ ...mergedContext, emitSchemas: true }));
  writeFileSync(resolve(generatedDir, 'types.ts'), renderOutput({ ...mergedContext, emitTypes: true }));
}

main().catch((error) => {
  console.error('Generation failed:', error);
  process.exit(1);
});
