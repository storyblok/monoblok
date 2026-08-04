import type { LocalFolder, SchemaData } from '../types';
import { CommandError, isRecord } from '../../../utils';
import { collectSchemaExports, loadSchemaModule } from '../../../utils/schema/classify-exports';
import { expandFolderPath } from '../folders';
import { mapBlockToWire, mapDatasourceToWire } from '../map-to-wire';

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

/**
 * Fails the load when two different definitions claim the same push identity.
 *
 * {@link collectSchemaExports} de-duplicates by object identity, so a name
 * collision arrives here as two entries. Left alone, the diff emits two `create`
 * actions for one name, both resolving to the first definition — the second is
 * dropped, the two concurrent creates race, and the first rejection aborts the
 * push after other entities were already written. Reporting it up front keeps
 * the failure deterministic and off the network. `schema validate` reports the
 * same collision as `duplicate_block_name` / `duplicate_datasource_slug`.
 */
function assertUniqueIdentities(
  components: Record<string, unknown>[],
  datasources: Record<string, unknown>[],
): void {
  const collisions: string[] = [];
  const collect = (label: string, values: unknown[]) => {
    const seen = new Set<string>();
    const reported = new Set<string>();
    for (const value of values) {
      if (typeof value !== 'string') { continue; }
      if (seen.has(value) && !reported.has(value)) {
        reported.add(value);
        collisions.push(`${label} "${value}"`);
      }
      seen.add(value);
    }
  };

  // Blocks and datasources are diffed by `name`; a datasource `slug` collision
  // is rejected by the Management API even when the names differ.
  collect('block name', components.map(component => component.name));
  collect('datasource name', datasources.map(datasource => datasource.name));
  collect('datasource slug', datasources.map(datasource => datasource.slug));

  if (collisions.length > 0) {
    throw new CommandError(
      `Duplicate schema definitions: ${collisions.join(', ')}. `
      + `Each block name, datasource name, and datasource slug must be unique; `
      + `rename or remove the duplicate before pushing.`,
    );
  }
}

/**
 * Classifies a module's exports into wire components, datasources, and folders,
 * mapping the content-shape DSL (`fields`/`allow`/`datasource`/`folder`) to the
 * MAPI wire shape. Raw classification (including identity-based de-duplication)
 * is shared with the validate commands via {@link collectSchemaExports}.
 */
export function classifyExports(moduleExports: Record<string, unknown>): SchemaData {
  const { components, datasources, folders } = collectSchemaExports(moduleExports);

  assertUniqueIdentities(components, datasources);

  // Harvest derived (unregistered) folder display paths from each component's
  // `folder` field and its `allow` entries. Reads the raw DSL objects, before
  // `mapBlockToWire` slugifies wire-side keys and loses display names.
  const registered = folders.map(folder => folder.path as string);
  const derived: string[] = [];
  for (const component of components) {
    if (typeof component.folder === 'string') { derived.push(component.folder); }
    if (Array.isArray(component.fields)) {
      for (const field of component.fields) {
        if (!isRecord(field) || !Array.isArray(field.allow)) { continue; }
        for (const entry of field.allow) {
          if (isRecord(entry) && typeof entry.folder === 'string') { derived.push(entry.folder); }
        }
      }
    }
  }

  return {
    components: components.map(mapBlockToWire),
    folders: buildLocalFolders(registered, derived),
    datasources: datasources.map(mapDatasourceToWire),
  };
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
  const entryMod = await loadSchemaModule(entryPath);
  return classifyExports(entryMod);
}
