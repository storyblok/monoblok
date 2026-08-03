import * as mapi from '../generated/mapi/sdk.gen';
import type {
  CreateSpaceSharedAssetFolderData,
  DeleteSpaceSharedAssetFolderData,
  GetSpaceSharedAssetFolderResponses,
  ListSpaceSharedAssetFoldersData,
  ListSpaceSharedAssetFoldersResponses,
  SharedAssetFolder,
  UpdateSpaceSharedAssetFolderData,
} from '../generated/mapi/types.gen';
import type { ApiResponse, FetchOptions, MapiResourceDeps } from '../client';
import { resolveSpaceId, type SpaceIdPathOverride } from './shared';

export type { SharedAssetFolder };

export type AccessLevel = 'read' | 'write';

export interface AssetFolderAccess {
  space_id: number;
  access_level: AccessLevel;
}

export type SharedAssetFolderCreate = CreateSpaceSharedAssetFolderData['body']['shared_asset_folder'];

export type SharedAssetFolderUpdate = UpdateSpaceSharedAssetFolderData['body']['shared_asset_folder'];

export type SharedAssetFolderListResponse = ListSpaceSharedAssetFoldersResponses[200];

export type SharedAssetFolderGetResponse = GetSpaceSharedAssetFolderResponses[200];

/**
 * A shared (organization-level) asset folder. Top-level folders
 * (`parent_id === null`) are "libraries"; per-space access is exposed via
 * `asset_folder_access`.
 */
export function createSharedAssetFoldersResource<DefaultThrowOnError extends boolean = false>(deps: MapiResourceDeps<DefaultThrowOnError>) {
  const { client, spaceId, wrapRequest } = deps;
  const getSpaceId = (path?: SpaceIdPathOverride['path']) => resolveSpaceId(spaceId, path);
  const kyOpts = (fetchOptions?: FetchOptions) =>
    fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {};
  const maybeThrow = (throwOnError?: boolean) => (throwOnError === undefined ? {} : { throwOnError });

  return {
    list<ThrowOnError extends boolean = false>(options: { query?: ListSpaceSharedAssetFoldersData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {}): Promise<ApiResponse<SharedAssetFolderListResponse, ThrowOnError>> {
      const { query, signal, path, throwOnError, fetchOptions } = options;
      return wrapRequest<SharedAssetFolderListResponse, ThrowOnError>(() =>
        mapi.listSpaceSharedAssetFolders({ client, path: { space_id: getSpaceId(path) }, query, signal, ...maybeThrow(throwOnError), ...kyOpts(fetchOptions) }), throwOnError);
    },
    get<ThrowOnError extends boolean = false>(folderId: number | string, options: { signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {}): Promise<ApiResponse<SharedAssetFolderGetResponse, ThrowOnError>> {
      const { signal, path, throwOnError, fetchOptions } = options;
      return wrapRequest<SharedAssetFolderGetResponse, ThrowOnError>(() =>
        mapi.getSpaceSharedAssetFolder({ client, path: { space_id: getSpaceId(path), id: Number(folderId) }, signal, ...maybeThrow(throwOnError), ...kyOpts(fetchOptions) }), throwOnError);
    },
    create<ThrowOnError extends boolean = false>(options: { body: { shared_asset_folder: SharedAssetFolderCreate }; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride): Promise<ApiResponse<SharedAssetFolderGetResponse, ThrowOnError>> {
      const { body, signal, path, throwOnError, fetchOptions } = options;
      return wrapRequest<SharedAssetFolderGetResponse, ThrowOnError>(() =>
        mapi.createSpaceSharedAssetFolder({ client, path: { space_id: getSpaceId(path) }, body, signal, ...maybeThrow(throwOnError), ...kyOpts(fetchOptions) }), throwOnError);
    },
    update<ThrowOnError extends boolean = false>(folderId: number | string, options: { body: { shared_asset_folder: SharedAssetFolderUpdate }; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride): Promise<ApiResponse<void, ThrowOnError>> {
      const { body, signal, path, throwOnError, fetchOptions } = options;
      return wrapRequest<void, ThrowOnError>(() =>
        mapi.updateSpaceSharedAssetFolder({ client, path: { space_id: getSpaceId(path), id: Number(folderId) }, body, signal, ...maybeThrow(throwOnError), ...kyOpts(fetchOptions) }), throwOnError);
    },
    delete<ThrowOnError extends boolean = false>(folderId: number | string, options: { query?: DeleteSpaceSharedAssetFolderData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {}): Promise<ApiResponse<void, ThrowOnError>> {
      const { query, signal, path, throwOnError, fetchOptions } = options;
      return wrapRequest<void, ThrowOnError>(() =>
        mapi.deleteSpaceSharedAssetFolder({ client, path: { space_id: getSpaceId(path), id: Number(folderId) }, query, signal, ...maybeThrow(throwOnError), ...kyOpts(fetchOptions) }), throwOnError);
    },
  };
}
