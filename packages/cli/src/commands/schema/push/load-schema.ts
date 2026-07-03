import type { SchemaData } from '../types';
import { mapBlockToWire, mapDatasourceToWire } from '../map-to-wire';
import { isRecord } from '../utils';

/** Returns true if the value looks like a `defineBlock()` result (content-shape DSL). */
export function isComponent(value: unknown): value is Record<string, unknown> {
  return isRecord(value)
    && typeof value.name === 'string'
    && Array.isArray(value.fields);
}

/** Returns true if the value looks like a `defineDatasource()` result. */
export function isDatasource(value: unknown): value is Record<string, unknown> {
  return isRecord(value)
    && typeof value.name === 'string'
    && typeof value.slug === 'string'
    && !Array.isArray(value.fields);
}

/** Returns true if the value looks like a schema object (e.g. `export const schema = { blocks: {...} }`). */
export function isSchemaObject(value: unknown): value is Record<string, Record<string, unknown>> {
  return isRecord(value)
    && ('blocks' in value || 'datasources' in value);
}

/** An empty {@link SchemaData}, used as the accumulator base. */
function emptySchemaData(): SchemaData {
  return { components: [], datasources: [] };
}

/**
 * Classifies a module's exports into wire components and datasources, mapping
 * the content-shape DSL (`fields`/`allow`/`datasource`) to the MAPI wire shape.
 */
export function classifyExports(moduleExports: Record<string, unknown>): SchemaData {
  const data = emptySchemaData();
  const seenComponents = new Set<string>();
  const seenDatasources = new Set<string>();

  function collect(value: unknown) {
    if (isComponent(value)) {
      if (seenComponents.has(value.name as string)) { return; }
      seenComponents.add(value.name as string);
      data.components.push(mapBlockToWire(value));
    }
    else if (isDatasource(value)) {
      if (seenDatasources.has(value.name as string)) { return; }
      seenDatasources.add(value.name as string);
      data.datasources.push(mapDatasourceToWire(value));
    }
  }

  for (const value of Object.values(moduleExports)) {
    if (isSchemaObject(value)) {
      // Unwrap schema object: collect from each sub-record (blocks, datasources)
      for (const group of Object.values(value)) {
        if (isRecord(group)) {
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

  return data;
}

/**
 * Loads a TypeScript schema entry file and returns classified exports.
 *
 * Blocks and datasources are sourced solely from the entry file's exports
 * (directly or via an exported `schema` object). A block must be registered in
 * the entry file to be pushed; leaving a block file on disk without exporting it
 * has no effect. Uses jiti for TypeScript support.
 */
export async function loadSchema(entryPath: string): Promise<SchemaData> {
  const { createJiti } = await import('jiti');
  const jiti = createJiti(import.meta.url, { interopDefault: true });
  const { resolve } = await import('pathe');

  const entryAbs = resolve(entryPath);
  const entryMod = await jiti.import(entryAbs) as Record<string, unknown>;

  return classifyExports(entryMod);
}
