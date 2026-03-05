import * as assetsApi from '../generated/assets/sdk.gen';
import type {
  BulkMoveData,
  BulkMoveResponses,
  BulkRestoreData,
  BulkRestoreResponses,
  DeleteManyData,
  DeleteManyResponses,
  FinalizeResponses,
  GetAllData,
  GetAllResponses,
  GetResponses,
  RemoveResponses,
  UpdateData,
  UpdateResponses,
  UploadData,
  UploadResponses,
} from '../generated/assets/types.gen';
import type { ApiResponse, MapiResourceDeps } from '../index';
import { resolveSpaceId, type SpaceIdPathOverride } from './shared';

export function createAssetsResource(deps: MapiResourceDeps) {
  const { client, spaceId, wrapRequest } = deps;
  const getSpaceId = (path?: SpaceIdPathOverride['path']) => resolveSpaceId(spaceId, path);

  return {
    getAll<ThrowOnError extends boolean = false>(options: { query?: GetAllData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError } & SpaceIdPathOverride = {}): Promise<ApiResponse<GetAllResponses[200], ThrowOnError>> {
      const { query, signal, path, throwOnError } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<GetAllResponses[200], ThrowOnError>(() =>
        assetsApi.getAll({ client, path: { space_id: resolvedSpaceId }, query, signal, ...(throwOnError === undefined ? {} : { throwOnError }) }), throwOnError);
    },
    upload<ThrowOnError extends boolean = false>(options: { body: UploadData['body']; signal?: AbortSignal; throwOnError?: ThrowOnError } & SpaceIdPathOverride): Promise<ApiResponse<UploadResponses[200], ThrowOnError>> {
      const { body, signal, path, throwOnError } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<UploadResponses[200], ThrowOnError>(() =>
        assetsApi.upload({ client, path: { space_id: resolvedSpaceId }, body, signal, ...(throwOnError === undefined ? {} : { throwOnError }) }), throwOnError);
    },
    get<ThrowOnError extends boolean = false>(assetId: number | string, options: { signal?: AbortSignal; throwOnError?: ThrowOnError } & SpaceIdPathOverride = {}): Promise<ApiResponse<GetResponses[200], ThrowOnError>> {
      const { signal, path, throwOnError } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<GetResponses[200], ThrowOnError>(() =>
        assetsApi.get({ client, path: { space_id: resolvedSpaceId, asset_id: assetId }, signal, ...(throwOnError === undefined ? {} : { throwOnError }) }), throwOnError);
    },
    update<ThrowOnError extends boolean = false>(
      assetId: number | string,
      options: { body: UpdateData['body']; signal?: AbortSignal; throwOnError?: ThrowOnError } & SpaceIdPathOverride,
    ): Promise<ApiResponse<UpdateResponses[200], ThrowOnError>> {
      const { body, signal, path, throwOnError } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<UpdateResponses[200], ThrowOnError>(() =>
        assetsApi.update({ client, path: { space_id: resolvedSpaceId, asset_id: assetId }, body, signal, ...(throwOnError === undefined ? {} : { throwOnError }) }), throwOnError);
    },
    remove<ThrowOnError extends boolean = false>(assetId: number | string, options: { signal?: AbortSignal; throwOnError?: ThrowOnError } & SpaceIdPathOverride = {}): Promise<ApiResponse<RemoveResponses[200], ThrowOnError>> {
      const { signal, path, throwOnError } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<RemoveResponses[200], ThrowOnError>(() =>
        assetsApi.remove({ client, path: { space_id: resolvedSpaceId, asset_id: assetId }, signal, ...(throwOnError === undefined ? {} : { throwOnError }) }), throwOnError);
    },
    finalize<ThrowOnError extends boolean = false>(signedResponseObjectId: string, options: { signal?: AbortSignal; throwOnError?: ThrowOnError } & SpaceIdPathOverride = {}): Promise<ApiResponse<FinalizeResponses[200], ThrowOnError>> {
      const { signal, path, throwOnError } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<FinalizeResponses[200], ThrowOnError>(() =>
        assetsApi.finalize({
          client,
          path: { space_id: resolvedSpaceId, signed_response_object_id: signedResponseObjectId },
          signal,
          ...(throwOnError === undefined ? {} : { throwOnError }),
        }), throwOnError);
    },
    deleteMany<ThrowOnError extends boolean = false>(options: { body: DeleteManyData['body']; signal?: AbortSignal; throwOnError?: ThrowOnError } & SpaceIdPathOverride): Promise<ApiResponse<DeleteManyResponses[200], ThrowOnError>> {
      const { body, signal, path, throwOnError } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<DeleteManyResponses[200], ThrowOnError>(() =>
        assetsApi.deleteMany({ client, path: { space_id: resolvedSpaceId }, body, signal, ...(throwOnError === undefined ? {} : { throwOnError }) }), throwOnError);
    },
    bulkMove<ThrowOnError extends boolean = false>(options: { body: BulkMoveData['body']; signal?: AbortSignal; throwOnError?: ThrowOnError } & SpaceIdPathOverride): Promise<ApiResponse<BulkMoveResponses[200], ThrowOnError>> {
      const { body, signal, path, throwOnError } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<BulkMoveResponses[200], ThrowOnError>(() =>
        assetsApi.bulkMove({ client, path: { space_id: resolvedSpaceId }, body, signal, ...(throwOnError === undefined ? {} : { throwOnError }) }), throwOnError);
    },
    bulkRestore<ThrowOnError extends boolean = false>(options: { body: BulkRestoreData['body']; signal?: AbortSignal; throwOnError?: ThrowOnError } & SpaceIdPathOverride): Promise<ApiResponse<BulkRestoreResponses[200], ThrowOnError>> {
      const { body, signal, path, throwOnError } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<BulkRestoreResponses[200], ThrowOnError>(() =>
        assetsApi.bulkRestore({ client, path: { space_id: resolvedSpaceId }, body, signal, ...(throwOnError === undefined ? {} : { throwOnError }) }), throwOnError);
    },
  };
}
