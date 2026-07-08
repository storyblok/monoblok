import { join } from 'pathe';
import { directories } from '../../constants';
import { getMapiClient } from '../../api';
import { handleAPIError } from '../../utils/error/api-error';
import { toError } from '../../utils/error/error';
import { resolveCommandPath } from '../../utils/filesystem';
import type { SharedAssetFolder } from './types';

/**
 * Identifies the destination/source of an asset operation: the active space's
 * own asset library, or one of the org's shared libraries.
 */
export type Scope =
  // `spaceId` is the local source/destination directory segment (e.g. a space
  // ID or a staging dir name like `qa-seed`), not necessarily a numeric ID.
  | { kind: 'space'; spaceId: string }
  | { kind: 'library'; libraryId: number };

export interface Library {
  id: number;
  name: string;
  uuid: string;
  accessLevel: 'read' | 'write';
}

/**
 * Resolves the on-disk base dir for a scope:
 * `.storyblok/assets/<space_id>/` or `.storyblok/assets/shared/<library_id>/`.
 */
export function resolveScopeBaseDir(scope: Scope, basePath: string | undefined): string {
  const segment = scope.kind === 'space'
    ? String(scope.spaceId)
    : join('shared', String(scope.libraryId));
  return resolveCommandPath(directories.assets, segment, basePath);
}

/**
 * Lists the top-level shared libraries the active space can access, with the
 * space's own access level. A "library" is a shared asset folder with
 * `parent_id === null`. Libraries the space cannot access are not returned.
 */
export async function listLibraries(spaceId: string): Promise<Library[]> {
  try {
    const { data } = await getMapiClient().sharedAssetFolders.list({
      path: { space_id: Number(spaceId) },
      throwOnError: true,
    });
    const folders: SharedAssetFolder[] = data?.shared_asset_folders ?? [];
    return folders
      .filter(folder => folder.parent_id === null || folder.parent_id === undefined)
      .map(folder => ({
        id: folder.id,
        name: folder.name,
        uuid: folder.uuid,
        accessLevel: folder.asset_folder_access?.find(access => access.space_id === Number(spaceId))?.access_level ?? 'read',
      }));
  }
  catch (maybeError) {
    handleAPIError('pull_shared_asset_folders', toError(maybeError));
  }
}

export const listReadableLibraries = (spaceId: string): Promise<Library[]> => listLibraries(spaceId);

export const listWritableLibraries = async (spaceId: string): Promise<Library[]> =>
  (await listLibraries(spaceId)).filter(library => library.accessLevel === 'write');

/**
 * Builds a resolver mapping any shared `asset_folder_id` to its top-level
 * library root id (walking `parent_id` up). Fetches the space's shared folders
 * once. Used to group referenced shared assets by library.
 */
export async function buildLibraryRootResolver(spaceId: string): Promise<(assetFolderId: number) => number> {
  const { data } = await getMapiClient().sharedAssetFolders.list({
    path: { space_id: Number(spaceId) },
    throwOnError: true,
  });
  const parentById = new Map<number, number | null>();
  for (const folder of data?.shared_asset_folders ?? []) {
    parentById.set(folder.id, folder.parent_id ?? null);
  }
  return (assetFolderId: number): number => {
    let current = assetFolderId;
    const seen = new Set<number>();
    while (!seen.has(current)) {
      seen.add(current);
      const parent = parentById.get(current);
      if (parent === null || parent === undefined) {
        return current;
      }
      current = parent;
    }
    return current;
  };
}

/** Throws if the active space cannot write to the target library. */
export async function assertLibraryWritable(spaceId: string, libraryId: number): Promise<Library> {
  const library = (await listLibraries(spaceId)).find(candidate => candidate.id === libraryId);
  if (!library) {
    throw new Error(`Library ${libraryId} is not accessible from space ${spaceId}.`);
  }
  if (library.accessLevel !== 'write') {
    throw new Error(`Library "${library.name}" (${libraryId}) is read-only for space ${spaceId}. No assets were pushed.`);
  }
  return library;
}
