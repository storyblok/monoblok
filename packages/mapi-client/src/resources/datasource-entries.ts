import * as mapi from '../generated/mapi/sdk.gen';
import type {
  CreateDatasourceEntryData,
  CreateDatasourceEntryResponses,
  DatasourceEntriesIndexResponse,
  GetDatasourceEntryResponses,
  ListDatasourceEntriesData,
  PartialUpdateDatasourceEntryData,
  PartialUpdateDatasourceEntryResponses,
  ReplaceDatasourceEntryData,
  ReplaceDatasourceEntryResponses,
} from '../generated/mapi/types.gen';
import type { ApiResponse, FetchOptions, MapiResourceDeps } from '../client';
import { resolveSpaceId, type SpaceIdPathOverride } from './shared';

export function createDatasourceEntriesResource<DefaultThrowOnError extends boolean = false>(deps: MapiResourceDeps<DefaultThrowOnError>) {
  const { client, spaceId, wrapRequest } = deps;
  const getSpaceId = (path?: SpaceIdPathOverride['path']) => resolveSpaceId(spaceId, path);

  return {
    list<ThrowOnError extends boolean = DefaultThrowOnError>(options: { query?: ListDatasourceEntriesData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {}): Promise<ApiResponse<DatasourceEntriesIndexResponse, ThrowOnError>> {
      const { query, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<DatasourceEntriesIndexResponse, ThrowOnError>(() =>
        mapi.listDatasourceEntries({ client, path: { space_id: resolvedSpaceId }, query, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },

    get<ThrowOnError extends boolean = DefaultThrowOnError>(datasourceEntryId: number, options: { signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {}): Promise<ApiResponse<GetDatasourceEntryResponses[200], ThrowOnError>> {
      const { signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<GetDatasourceEntryResponses[200], ThrowOnError>(() =>
        mapi.getDatasourceEntry({
          client,
          path: { space_id: resolvedSpaceId, id: datasourceEntryId },
          signal,
          ...(throwOnError === undefined ? {} : { throwOnError }),
          ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}),
        }), throwOnError);
    },

    create<ThrowOnError extends boolean = DefaultThrowOnError>(options: { body: CreateDatasourceEntryData['body']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride): Promise<ApiResponse<CreateDatasourceEntryResponses[201], ThrowOnError>> {
      const { body, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<CreateDatasourceEntryResponses[201], ThrowOnError>(() =>
        mapi.createDatasourceEntry({ client, path: { space_id: resolvedSpaceId }, body, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },

    /**
     * PATCH /datasource_entries/{id}: partial update.
     */
    update<ThrowOnError extends boolean = DefaultThrowOnError>(
      datasourceEntryId: number,
      options: { body: PartialUpdateDatasourceEntryData['body']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride,
    ): Promise<ApiResponse<PartialUpdateDatasourceEntryResponses[204], ThrowOnError>> {
      const { body, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<PartialUpdateDatasourceEntryResponses[204], ThrowOnError>(() =>
        mapi.partialUpdateDatasourceEntry({
          client,
          path: { space_id: resolvedSpaceId, id: datasourceEntryId },
          body,
          signal,
          ...(throwOnError === undefined ? {} : { throwOnError }),
          ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}),
        }), throwOnError);
    },
    /**
     * PUT /datasource_entries/{id}: full replace.
     */
    replace<ThrowOnError extends boolean = DefaultThrowOnError>(
      datasourceEntryId: number,
      options: { body: ReplaceDatasourceEntryData['body']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride,
    ): Promise<ApiResponse<ReplaceDatasourceEntryResponses[204], ThrowOnError>> {
      const { body, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<ReplaceDatasourceEntryResponses[204], ThrowOnError>(() =>
        mapi.replaceDatasourceEntry({
          client,
          path: { space_id: resolvedSpaceId, id: datasourceEntryId },
          body,
          signal,
          ...(throwOnError === undefined ? {} : { throwOnError }),
          ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}),
        }), throwOnError);
    },
    delete<ThrowOnError extends boolean = DefaultThrowOnError>(datasourceEntryId: number, options: { signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {}): Promise<ApiResponse<void, ThrowOnError>> {
      const { signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<void, ThrowOnError>(() =>
        mapi.deleteDatasourceEntry({
          client,
          path: { space_id: resolvedSpaceId, id: datasourceEntryId },
          signal,
          ...(throwOnError === undefined ? {} : { throwOnError }),
          ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}),
        }), throwOnError);
    },
  };
}
