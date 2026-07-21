import type { LocalFolder, SchemaData } from '../types';
import { CommandError } from '../../../utils';
import { mapBlockToWire, mapDatasourceToWire } from '../map-to-wire';
import { expandFolderPath } from '../folders';
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

/** Returns true if the value looks like a `defineFolder()` result. */
export function isFolder(value: unknown): value is Record<string, unknown> {
  return isRecord(value)
    && typeof value.name === 'string'
    && typeof value.path === 'string'
    && !Array.isArray(value.fields)
    && !('slug' in value);
}

/**
 * Builds the deduped, parent-first {@link LocalFolder} list from harvested
 * display paths. `registered` paths come from `defineFolder()` objects;
 * `derived` paths come from block `folder` fields and `allow` entries.
 * Dedupe is by slug path. Display-name precedence: a registered `defineFolder`
 * wins over a derived segment. Two registered folders resolving to the same
 * slug path with different display names is a conflict.
 */
function buildLocalFolders(registered: string[], derived: string[]): LocalFolder[] {
  const byPath = new Map<string, { folder: LocalFolder; isRegistered: boolean }>();
  const add = (displayPath: string, registeredLeaf: boolean) => {
    const expanded = expandFolderPath(displayPath);
    expanded.forEach((entry, i) => {
      const isLeaf = i === expanded.length - 1;
      const isRegisteredEntry = registeredLeaf && isLeaf;
      const existing = byPath.get(entry.path);
      if (!existing) {
        byPath.set(entry.path, { folder: entry, isRegistered: isRegisteredEntry });
        return;
      }
      if (isRegisteredEntry && existing.isRegistered && existing.folder.name !== entry.name) {
        throw new CommandError(`Conflicting folder names for path "${entry.path}": "${existing.folder.name}" vs "${entry.name}"`);
      }
      if (isRegisteredEntry && !existing.isRegistered) {
        byPath.set(entry.path, { folder: entry, isRegistered: true });
      }
    });
  };
  for (const path of registered) { add(path, true); }
  for (const path of derived) { add(path, false); }
  const folders = [...byPath.values()]
    .map(v => v.folder)
    .sort((a, b) => a.path.split('/').length - b.path.split('/').length || a.path.localeCompare(b.path));

  // Storyblok component group names are unique per SPACE (not per parent), so
  // reject duplicate slugified leaf names across the whole set. Without this
  // guard duplicates pass load/diff and 422 mid-push with a misleading message.
  const leafToPath = new Map<string, string>();
  for (const folder of folders) {
    const leaf = folder.path.split('/').pop() ?? folder.path;
    const existing = leafToPath.get(leaf);
    if (existing !== undefined && existing !== folder.path) {
      throw new CommandError(
        `Duplicate folder name "${leaf}" (folders "${existing}" and "${folder.path}"): `
        + `Storyblok group names must be unique per space, even under different parents.`,
      );
    }
    leafToPath.set(leaf, folder.path);
  }

  return folders;
}

/** Returns true if the value looks like a schema object (e.g. `export const schema = { blocks: {...}, datasources: {...}, folders: {...} }`). */
export function isSchemaObject(value: unknown): value is Record<string, Record<string, unknown>> {
  return isRecord(value)
    && ('blocks' in value || 'datasources' in value || 'folders' in value);
}

/** An empty {@link SchemaData}, used as the accumulator base. */
function emptySchemaData(): SchemaData {
  return { components: [], folders: [], datasources: [] };
}

/**
 * Classifies a module's exports into wire components and datasources, mapping
 * the content-shape DSL (`fields`/`allow`/`datasource`) to the MAPI wire shape.
 */
export function classifyExports(moduleExports: Record<string, unknown>): SchemaData {
  const data = emptySchemaData();
  const seenComponents = new Set<string>();
  const seenDatasources = new Set<string>();
  const registered: string[] = [];
  const derived: string[] = [];

  // Harvests derived (unregistered) folder display paths from a component's
  // `folder` field and its `allow` entries. Must run on the raw DSL object,
  // before `mapBlockToWire` slugifies wire-side keys and loses display names.
  function harvestComponentPaths(value: Record<string, unknown>) {
    if (typeof value.folder === 'string') { derived.push(value.folder); }
    if (Array.isArray(value.fields)) {
      for (const field of value.fields) {
        if (!isRecord(field) || !Array.isArray(field.allow)) { continue; }
        for (const entry of field.allow) {
          if (isRecord(entry) && typeof entry.folder === 'string') { derived.push(entry.folder); }
        }
      }
    }
  }

  function collect(value: unknown) {
    if (isComponent(value)) {
      harvestComponentPaths(value);
      if (seenComponents.has(value.name as string)) { return; }
      seenComponents.add(value.name as string);
      data.components.push(mapBlockToWire(value));
    }
    else if (isFolder(value)) {
      registered.push(value.path as string);
    }
    else if (isDatasource(value)) {
      if (seenDatasources.has(value.name as string)) { return; }
      seenDatasources.add(value.name as string);
      data.datasources.push(mapDatasourceToWire(value));
    }
  }

  for (const value of Object.values(moduleExports)) {
    if (isSchemaObject(value)) {
      // Unwrap schema object: collect from each sub-record (blocks, datasources, folders)
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

  data.folders = buildLocalFolders(registered, derived);

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
