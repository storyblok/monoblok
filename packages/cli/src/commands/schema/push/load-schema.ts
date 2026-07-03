import type { LocalFolder, SchemaData } from '../types';
import { CommandError } from '../../../utils';
import { collectSchemaExports, isRecord, loadSchemaModule } from '../../../utils/schema/classify-exports';
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
 * Classifies a module's exports into wire components, datasources, and folders,
 * mapping the content-shape DSL (`fields`/`allow`/`datasource`/`folder`) to the
 * MAPI wire shape. Raw classification (including identity-based de-duplication)
 * is shared with the validate commands via {@link collectSchemaExports}.
 */
export function classifyExports(moduleExports: Record<string, unknown>): SchemaData {
  const { components, datasources, folders } = collectSchemaExports(moduleExports);

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
