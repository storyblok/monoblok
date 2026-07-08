import type { ApiResponse, FetchOptions, MapiResourceDeps } from '../index';
import { resolveSpaceId, type SpaceIdPathOverride } from './shared';

export type AccessLevel = 'read' | 'write';

export interface AssetFolderAccess {
  space_id: number;
  access_level: AccessLevel;
}

/**
 * A shared (organization-level) asset folder. Top-level folders
 * (`parent_id === null`) are "libraries"; per-space access is exposed via
 * `asset_folder_access`. Not part of the generated SDK — these endpoints are
 * issued as raw `client.*` calls.
 */
export interface SharedAssetFolder {
  id: number;
  name: string;
  parent_id: number | null;
  uuid: string;
  parent_uuid?: string | null;
  description?: string | null;
  color?: string | null;
  regions?: string[];
  asset_folder_access?: AssetFolderAccess[];
}

export interface SharedAssetFolderCreate {
  name: string;
  parent_id?: number | null;
  description?: string | null;
  color?: string | null;
  regions?: string[];
  asset_folder_access?: AssetFolderAccess[];
}

export type SharedAssetFolderUpdate = Partial<SharedAssetFolderCreate>;

export interface SharedAssetFolderListResponse {
  shared_asset_folders: SharedAssetFolder[];
}

export interface SharedAssetFolderGetResponse {
  shared_asset_folder: SharedAssetFolder;
}

export function createSharedAssetFoldersResource(deps: MapiResourceDeps) {
  const { client, spaceId, wrapRequest } = deps;
  const getSpaceId = (path?: SpaceIdPathOverride['path']) => resolveSpaceId(spaceId, path);
  const kyOpts = (fetchOptions?: FetchOptions) =>
    fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {};
  const maybeThrow = (throwOnError?: boolean) => (throwOnError === undefined ? {} : { throwOnError });

  return {
    list<ThrowOnError extends boolean = false>(options: { query?: { search?: string; with_parent?: string; by_ids?: string }; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {}): Promise<ApiResponse<SharedAssetFolderListResponse, ThrowOnError>> {
      const { query, signal, path, throwOnError, fetchOptions } = options;
      return wrapRequest<SharedAssetFolderListResponse, ThrowOnError>(() =>
        client.get({ url: '/v1/spaces/{space_id}/shared_asset_folders', path: { space_id: getSpaceId(path) }, query, signal, ...maybeThrow(throwOnError), ...kyOpts(fetchOptions) }), throwOnError);
    },
    get<ThrowOnError extends boolean = false>(folderId: number | string, options: { signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {}): Promise<ApiResponse<SharedAssetFolderGetResponse, ThrowOnError>> {
      const { signal, path, throwOnError, fetchOptions } = options;
      return wrapRequest<SharedAssetFolderGetResponse, ThrowOnError>(() =>
        client.get({ url: '/v1/spaces/{space_id}/shared_asset_folders/{asset_folder_id}', path: { space_id: getSpaceId(path), asset_folder_id: folderId }, signal, ...maybeThrow(throwOnError), ...kyOpts(fetchOptions) }), throwOnError);
    },
    create<ThrowOnError extends boolean = false>(options: { body: { shared_asset_folder: SharedAssetFolderCreate }; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride): Promise<ApiResponse<SharedAssetFolderGetResponse, ThrowOnError>> {
      const { body, signal, path, throwOnError, fetchOptions } = options;
      return wrapRequest<SharedAssetFolderGetResponse, ThrowOnError>(() =>
        client.post({ url: '/v1/spaces/{space_id}/shared_asset_folders', path: { space_id: getSpaceId(path) }, body, signal, ...maybeThrow(throwOnError), ...kyOpts(fetchOptions) }), throwOnError);
    },
    update<ThrowOnError extends boolean = false>(folderId: number | string, options: { body: { shared_asset_folder: SharedAssetFolderUpdate }; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride): Promise<ApiResponse<void, ThrowOnError>> {
      const { body, signal, path, throwOnError, fetchOptions } = options;
      return wrapRequest<void, ThrowOnError>(() =>
        client.put({ url: '/v1/spaces/{space_id}/shared_asset_folders/{asset_folder_id}', path: { space_id: getSpaceId(path), asset_folder_id: folderId }, body, signal, ...maybeThrow(throwOnError), ...kyOpts(fetchOptions) }), throwOnError);
    },
    delete<ThrowOnError extends boolean = false>(folderId: number | string, options: { query?: { recursive?: boolean }; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {}): Promise<ApiResponse<void, ThrowOnError>> {
      const { query, signal, path, throwOnError, fetchOptions } = options;
      return wrapRequest<void, ThrowOnError>(() =>
        client.delete({ url: '/v1/spaces/{space_id}/shared_asset_folders/{asset_folder_id}', path: { space_id: getSpaceId(path), asset_folder_id: folderId }, query, signal, ...maybeThrow(throwOnError), ...kyOpts(fetchOptions) }), throwOnError);
    },
  };
}
