import * as mapi from '../generated/mapi/sdk.gen';
import type {
  CreateDatasourceData,
  CreateDatasourceResponses,
  GetDatasourceResponses,
  ListDatasourcesData,
  ListDatasourcesResponses,
  PartialUpdateDatasourceData,
  PartialUpdateDatasourceResponses,
  ReplaceDatasourceData,
  ReplaceDatasourceResponses,
} from '../generated/mapi/types.gen';
import type { ApiResponse, FetchOptions, MapiResourceDeps } from '../client';
import { resolveSpaceId, type SpaceIdPathOverride } from './shared';

export function createDatasourcesResource<DefaultThrowOnError extends boolean = false>(deps: MapiResourceDeps<DefaultThrowOnError>) {
  const { client, spaceId, wrapRequest } = deps;
  const getSpaceId = (path?: SpaceIdPathOverride['path']) => resolveSpaceId(spaceId, path);

  return {
    list<ThrowOnError extends boolean = DefaultThrowOnError>(options: { query?: ListDatasourcesData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {}): Promise<ApiResponse<ListDatasourcesResponses[200], ThrowOnError>> {
      const { query, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<ListDatasourcesResponses[200], ThrowOnError>(() =>
        mapi.listDatasources({ client, path: { space_id: resolvedSpaceId }, query, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    get<ThrowOnError extends boolean = DefaultThrowOnError>(datasourceId: number | string, options: { signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {}): Promise<ApiResponse<GetDatasourceResponses[200], ThrowOnError>> {
      const { signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<GetDatasourceResponses[200], ThrowOnError>(() =>
        mapi.getDatasource({ client, path: { space_id: resolvedSpaceId, id: String(datasourceId) }, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    create<ThrowOnError extends boolean = DefaultThrowOnError>(options: { body: CreateDatasourceData['body']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride): Promise<ApiResponse<CreateDatasourceResponses[201], ThrowOnError>> {
      const { body, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<CreateDatasourceResponses[201], ThrowOnError>(() =>
        mapi.createDatasource({ client, path: { space_id: resolvedSpaceId }, body, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    /**
     * PATCH /datasources/{id}: partial update. Only fields present in the body are changed.
     */
    update<ThrowOnError extends boolean = DefaultThrowOnError>(
      datasourceId: number | string,
      options: { body: PartialUpdateDatasourceData['body']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride,
    ): Promise<ApiResponse<PartialUpdateDatasourceResponses[200], ThrowOnError>> {
      const { body, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<PartialUpdateDatasourceResponses[200], ThrowOnError>(() =>
        mapi.partialUpdateDatasource({ client, path: { space_id: resolvedSpaceId, id: String(datasourceId) }, body, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    /**
     * PUT /datasources/{id}: full replace. All updatable fields are replaced.
     */
    replace<ThrowOnError extends boolean = DefaultThrowOnError>(
      datasourceId: number | string,
      options: { body: ReplaceDatasourceData['body']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride,
    ): Promise<ApiResponse<ReplaceDatasourceResponses[200], ThrowOnError>> {
      const { body, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<ReplaceDatasourceResponses[200], ThrowOnError>(() =>
        mapi.replaceDatasource({ client, path: { space_id: resolvedSpaceId, id: String(datasourceId) }, body, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    delete<ThrowOnError extends boolean = DefaultThrowOnError>(datasourceId: number | string, options: { signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {}): Promise<ApiResponse<void, ThrowOnError>> {
      const { signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<void, ThrowOnError>(() =>
        mapi.deleteDatasource({ client, path: { space_id: resolvedSpaceId, id: String(datasourceId) }, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
  };
}
