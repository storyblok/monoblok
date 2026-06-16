import type { RemoteSchemaData, SchemaData } from '../types';
import { deriveFolderNodes, type FolderNode, groupUuidForBlock, type ResolvedFolder, resolveExistingFolders } from '../folders';

export interface FolderResolution {
  /** Local schema with `component_group_uuid` set for blocks whose group already exists remotely. */
  resolved: SchemaData;
  /** Folder nodes that must be created remotely, shallow-first (parent before child). */
  foldersToCreate: FolderNode[];
  /** Path key → remote `{ id, uuid }` for folders that already exist. Grows as folders are created. */
  folderResolution: Map<string, ResolvedFolder>;
}

/**
 * Resolves the directory-derived component groups against the remote space.
 *
 * For every block with a group path, sets `component_group_uuid` when its
 * deepest folder already exists remotely; folders that don't exist yet are
 * returned in `foldersToCreate` (shallow-first) and their blocks are back-filled
 * after creation during push. The directory layout is the sole source of a
 * block's group.
 */
export function resolveFolderReferences(
  local: SchemaData,
  remote: RemoteSchemaData,
): FolderResolution {
  const nodes = deriveFolderNodes(local.folderPathByComponentName);
  const { resolved: folderResolution, toCreate } = resolveExistingFolders(
    nodes,
    [...remote.componentFolders.values()],
  );

  const resolvedComponents = local.components.map((comp) => {
    const path = local.folderPathByComponentName.get(comp.name);
    const uuid = groupUuidForBlock(path, folderResolution);
    return uuid ? { ...comp, component_group_uuid: uuid } : comp;
  });

  return {
    resolved: { ...local, components: resolvedComponents },
    foldersToCreate: toCreate,
    folderResolution,
  };
}
