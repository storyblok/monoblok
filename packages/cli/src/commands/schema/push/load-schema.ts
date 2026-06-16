import type { SchemaData } from '../types';
import { mapBlockToWire, mapDatasourceToWire } from '../map-to-wire';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Returns true if the value looks like a `defineBlock()` result (content-shape DSL). */
export function isComponent(value: unknown): value is Record<string, unknown> {
  return isObject(value)
    && typeof value.name === 'string'
    && Array.isArray(value.fields);
}

/** Returns true if the value looks like a `defineDatasource()` result. */
export function isDatasource(value: unknown): value is Record<string, unknown> {
  return isObject(value)
    && typeof value.name === 'string'
    && typeof value.slug === 'string'
    && !Array.isArray(value.fields);
}

/** Returns true if the value looks like a schema object (e.g. `export const schema = { blocks: {...} }`). */
export function isSchemaObject(value: unknown): value is Record<string, Record<string, unknown>> {
  return isObject(value)
    && ('blocks' in value || 'datasources' in value);
}

/**
 * Classifies a module's exports into wire components and datasources, mapping
 * the content-shape DSL (`fields`/`allow`/`datasource`/inline `presets`/`entries`)
 * to the MAPI wire shape. Inline presets and entries are lifted off for separate
 * reconciliation.
 */
export function classifyExports(moduleExports: Record<string, unknown>): SchemaData {
  const components: SchemaData['components'] = [];
  const datasources: SchemaData['datasources'] = [];

  function collect(value: unknown) {
    if (isComponent(value)) {
      components.push(mapBlockToWire(value).component);
    }
    else if (isDatasource(value)) {
      datasources.push(mapDatasourceToWire(value).datasource);
    }
  }

  for (const value of Object.values(moduleExports)) {
    if (isSchemaObject(value)) {
      // Unwrap schema object: collect from each sub-record (blocks, datasources)
      for (const group of Object.values(value)) {
        if (isObject(group)) {
          for (const entity of Object.values(group)) {
            collect(entity);
          }
        }
      }
    }
    else {
      collect(value);
    }
  }

  return { components, componentFolders: [], datasources };
}

/**
 * Loads a TypeScript schema entry file and returns classified exports.
 * Uses jiti for TypeScript support across all Node.js versions.
 */
export async function loadSchema(entryPath: string): Promise<SchemaData> {
  const { createJiti } = await import('jiti');
  const jiti = createJiti(import.meta.url, {
    interopDefault: true,
  });

  const absolutePath = (await import('pathe')).resolve(entryPath);
  const mod = await jiti.import(absolutePath) as Record<string, unknown>;

  return classifyExports(mod);
}
