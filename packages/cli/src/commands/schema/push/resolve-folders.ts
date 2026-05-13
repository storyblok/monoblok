import type { ComponentFolder } from '../../../types';
import type { RemoteSchemaData, SchemaData } from '../types';

/** Finds a remote folder by UUID (remote map is keyed by name). */
function findRemoteFolderByUuid(
  remoteFolders: Map<string, ComponentFolder>,
  uuid: string,
): ComponentFolder | undefined {
  for (const folder of remoteFolders.values()) {
    if (folder.uuid === uuid) { return folder; }
  }
  return undefined;
}

/**
 * Resolves local component folder UUIDs to remote UUIDs.
 *
 * For each component with `component_group_uuid`:
 * 1. Find a local folder whose `uuid` matches → get its name
 * 2. Try direct UUID match against remote folders (supports renames within a single space)
 * 3. Fall back to name match (cross-space portability)
 * 4. Neither → mark as pending (folder created later in push)
 * 5. No matching local folder → pass through unchanged (backward compat)
 *
 * @returns `resolved` SchemaData with updated `component_group_uuid` values,
 *          and `pendingFolderAssignments` for folders not yet created remotely.
 */
export function resolveFolderReferences(
  local: SchemaData,
  remote: RemoteSchemaData,
): { resolved: SchemaData; pendingFolderAssignments: Map<string, string[]> } {
  // Build lookup: local folder uuid → folder name
  const localUuidToName = new Map<string, string>();
  for (const folder of local.componentFolders) {
    if (folder.uuid) {
      localUuidToName.set(folder.uuid, folder.name);
    }
  }

  const pendingFolderAssignments = new Map<string, string[]>();

  const resolvedComponents = local.components.map((comp) => {
    if (!comp.component_group_uuid) { return comp; }

    const folderName = localUuidToName.get(comp.component_group_uuid);
    if (!folderName) {
      // Not a local folder reference — pass through (raw API UUID or unknown)
      return comp;
    }

    // Try direct UUID match first (supports single-space workflows + renames)
    const remoteByUuid = findRemoteFolderByUuid(remote.componentFolders, comp.component_group_uuid);
    if (remoteByUuid) {
      return comp; // UUID already valid remotely — no replacement needed
    }

    // Fall back to name match (cross-space portability)
    const remoteByName = remote.componentFolders.get(folderName);
    if (remoteByName) {
      return { ...comp, component_group_uuid: remoteByName.uuid };
    }

    // Folder exists locally but not remotely — mark as pending
    const pending = pendingFolderAssignments.get(folderName) ?? [];
    pending.push(comp.name);
    pendingFolderAssignments.set(folderName, pending);
    return comp;
  });

  return {
    resolved: { ...local, components: resolvedComponents },
    pendingFolderAssignments,
  };
}
