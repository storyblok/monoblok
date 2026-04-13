import type { Component, ComponentFolder, Datasource } from '../../../types';
import type { SchemaData } from '../types';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Returns true if the value looks like a defineBlock() result. */
export function isComponent(value: unknown): value is Component {
  return isObject(value)
    && typeof value.name === 'string'
    && 'schema' in value
    && isObject(value.schema);
}

/** Returns true if the value looks like a defineDatasource() result. */
export function isDatasource(value: unknown): value is Datasource {
  return isObject(value)
    && typeof value.name === 'string'
    && typeof value.slug === 'string'
    && !('schema' in value);
}

/** Returns true if the value looks like a defineBlockFolder() result. */
export function isComponentFolder(value: unknown): value is ComponentFolder {
  return isObject(value)
    && typeof value.name === 'string'
    && !('schema' in value)
    && !('slug' in value)
    && ('uuid' in value || 'parent_id' in value);
}

/** Returns true if the value looks like a schema object (e.g. `export const schema = { components: {...} }`). */
export function isSchemaObject(value: unknown): value is Record<string, Record<string, unknown>> {
  return isObject(value)
    && ('components' in value || 'componentFolders' in value || 'datasources' in value);
}

/** Classifies a module's exports into components, component folders, and datasources. */
export function classifyExports(moduleExports: Record<string, unknown>): SchemaData {
  const components: Component[] = [];
  const componentFolders: ComponentFolder[] = [];
  const datasources: Datasource[] = [];

  function collect(value: unknown) {
    if (isComponent(value)) {
      components.push(value);
    }
    else if (isDatasource(value)) {
      datasources.push(value);
    }
    else if (isComponentFolder(value)) {
      componentFolders.push(value);
    }
  }

  for (const value of Object.values(moduleExports)) {
    if (isSchemaObject(value)) {
      // Unwrap schema object: collect from each sub-record
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

  return { components, componentFolders, datasources };
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
