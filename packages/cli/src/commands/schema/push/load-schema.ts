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

  return data;
}

/** Recursively collects `.ts`/`.js` files under a directory (skips declaration files). */
async function walkSourceFiles(
  dir: string,
  fs: typeof import('node:fs/promises'),
  join: (...parts: string[]) => string,
): Promise<string[]> {
  const out: string[] = [];
  let names: string[];
  try {
    names = await fs.readdir(dir);
  }
  catch {
    return out;
  }
  for (const name of names) {
    const full = join(dir, name);
    const stat = await fs.stat(full);
    if (stat.isDirectory()) {
      out.push(...await walkSourceFiles(full, fs, join));
    }
    else if (/\.(?:ts|js|mts|mjs)$/.test(name) && !/\.d\.ts$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Loads a TypeScript schema entry file and returns classified exports.
 *
 * Blocks and datasources are sourced from the entry file. When a sibling
 * `components/` or `blocks/` directory exists, it is also walked file-by-file so
 * blocks organized into subdirectories are discovered even if the entry file
 * doesn't re-export them. The directory layout is local organization only and
 * does not affect the pushed (flat) component groups. Uses jiti for TypeScript
 * support.
 */
export async function loadSchema(entryPath: string): Promise<SchemaData> {
  const { createJiti } = await import('jiti');
  const jiti = createJiti(import.meta.url, { interopDefault: true });
  const { resolve, dirname, join } = await import('pathe');
  const fs = await import('node:fs/promises');

  const entryAbs = resolve(entryPath);
  const entryDir = dirname(entryAbs);

  const entryMod = await jiti.import(entryAbs) as Record<string, unknown>;
  const data = classifyExports(entryMod);

  // Discover blocks laid out in a sibling components directory.
  let componentsDir: string | undefined;
  for (const candidate of [join(entryDir, 'components'), join(entryDir, 'blocks')]) {
    try {
      if ((await fs.stat(candidate)).isDirectory()) { componentsDir = candidate; break; }
    }
    catch { /* not present */ }
  }

  if (componentsDir) {
    const files = await walkSourceFiles(componentsDir, fs, join);
    for (const file of files) {
      const mod = await jiti.import(file) as Record<string, unknown>;
      for (const value of Object.values(mod)) {
        if (!isComponent(value)) { continue; }
        const name = value.name as string;
        if (!data.components.some(c => c.name === name)) {
          data.components.push(mapBlockToWire(value));
        }
      }
    }
  }

  return data;
}
