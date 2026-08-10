import * as mapi from "../generated/mapi/sdk.gen";
import type {
  CreateSpaceSharedAssetFolderData,
  CreateSpaceSharedAssetFolderResponses,
  DeleteSpaceSharedAssetFolderData,
  GetSpaceSharedAssetFolderResponses,
  ListSpaceSharedAssetFoldersData,
  ListSpaceSharedAssetFoldersResponses,
  UpdateSpaceSharedAssetFolderData,
} from "../generated/mapi/types.gen";
import type { ApiResponse, FetchOptions, MapiResourceDeps } from "../client";
import { resolveSpaceId, type SpaceIdPathOverride } from "./shared";

/**
 * Shared (organization-level) asset folders. A folder the server returns with
 * `parent_id: null` is a "library" root; per-space access is exposed via
 * `asset_folder_access`. The active space must have read (list/get) or write
 * (create/update/delete) access to the library.
 *
 * Library roots cannot be created from a space — only in org context, via
 * `POST /v1/orgs/{org_id}/shared_asset_folders`. `create()` here therefore
 * always makes a child folder: `parent_id` is a plain `number` (no `null` to
 * pass), and omitting it fails with 400 "Cannot create shared root asset folder
 * in space context." `update()` does accept `parent_id: null`.
 */
export function createSharedAssetFoldersResource<DefaultThrowOnError extends boolean = false>(
  deps: MapiResourceDeps<DefaultThrowOnError>,
) {
  const { client, spaceId, wrapRequest } = deps;
  const getSpaceId = (path?: SpaceIdPathOverride["path"]) => resolveSpaceId(spaceId, path);
  const kyOpts = (fetchOptions?: FetchOptions) =>
    fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {};
  const maybeThrow = (throwOnError?: boolean) =>
    throwOnError === undefined ? {} : { throwOnError };

  return {
    list<ThrowOnError extends boolean = false>(
      options: {
        query?: ListSpaceSharedAssetFoldersData["query"];
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } & SpaceIdPathOverride = {},
    ): Promise<ApiResponse<ListSpaceSharedAssetFoldersResponses[200], ThrowOnError>> {
      const { query, signal, path, throwOnError, fetchOptions } = options;
      return wrapRequest<ListSpaceSharedAssetFoldersResponses[200], ThrowOnError>(
        () =>
          mapi.listSpaceSharedAssetFolders({
            client,
            path: { space_id: getSpaceId(path) },
            query,
            signal,
            ...maybeThrow(throwOnError),
            ...kyOpts(fetchOptions),
          }),
        throwOnError,
      );
    },
    get<ThrowOnError extends boolean = false>(
      folderId: number,
      options: {
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } & SpaceIdPathOverride = {},
    ): Promise<ApiResponse<GetSpaceSharedAssetFolderResponses[200], ThrowOnError>> {
      const { signal, path, throwOnError, fetchOptions } = options;
      return wrapRequest<GetSpaceSharedAssetFolderResponses[200], ThrowOnError>(
        () =>
          mapi.getSpaceSharedAssetFolder({
            client,
            path: { space_id: getSpaceId(path), id: folderId },
            signal,
            ...maybeThrow(throwOnError),
            ...kyOpts(fetchOptions),
          }),
        throwOnError,
      );
    },
    create<ThrowOnError extends boolean = false>(
      options: {
        body: CreateSpaceSharedAssetFolderData["body"];
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } & SpaceIdPathOverride,
    ): Promise<ApiResponse<CreateSpaceSharedAssetFolderResponses[201], ThrowOnError>> {
      const { body, signal, path, throwOnError, fetchOptions } = options;
      return wrapRequest<CreateSpaceSharedAssetFolderResponses[201], ThrowOnError>(
        () =>
          mapi.createSpaceSharedAssetFolder({
            client,
            path: { space_id: getSpaceId(path) },
            body,
            signal,
            ...maybeThrow(throwOnError),
            ...kyOpts(fetchOptions),
          }),
        throwOnError,
      );
    },
    update<ThrowOnError extends boolean = false>(
      folderId: number,
      options: {
        body: UpdateSpaceSharedAssetFolderData["body"];
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } & SpaceIdPathOverride,
    ): Promise<ApiResponse<void, ThrowOnError>> {
      const { body, signal, path, throwOnError, fetchOptions } = options;
      return wrapRequest<void, ThrowOnError>(
        () =>
          mapi.updateSpaceSharedAssetFolder({
            client,
            path: { space_id: getSpaceId(path), id: folderId },
            body,
            signal,
            ...maybeThrow(throwOnError),
            ...kyOpts(fetchOptions),
          }),
        throwOnError,
      );
    },
    delete<ThrowOnError extends boolean = false>(
      folderId: number,
      options: {
        query?: DeleteSpaceSharedAssetFolderData["query"];
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } & SpaceIdPathOverride = {},
    ): Promise<ApiResponse<void, ThrowOnError>> {
      const { query, signal, path, throwOnError, fetchOptions } = options;
      return wrapRequest<void, ThrowOnError>(
        () =>
          mapi.deleteSpaceSharedAssetFolder({
            client,
            path: { space_id: getSpaceId(path), id: folderId },
            query,
            signal,
            ...maybeThrow(throwOnError),
            ...kyOpts(fetchOptions),
          }),
        throwOnError,
      );
    },
  };
}
