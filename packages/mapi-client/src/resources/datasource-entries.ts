import * as datasourceEntriesApi from '../generated/datasource_entries/sdk.gen';
import type {
  CreateData,
  CreateResponses,
  GetAllData,
  GetAllResponses,
  GetResponses,
  UpdateData,
  UpdateResponses,
} from '../generated/datasource_entries/types.gen';
import type { ApiResponse, MapiResourceDeps } from '../index';
import { resolveSpaceId, type SpaceIdPathOverride } from './shared';

export function createDatasourceEntriesResource(deps: MapiResourceDeps) {
  const { client, spaceId, wrapRequest } = deps;
  const getSpaceId = (path?: SpaceIdPathOverride['path']) => resolveSpaceId(spaceId, path);

  return {
    getAll<ThrowOnError extends boolean = false>(options: { query?: GetAllData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError } & SpaceIdPathOverride = {}): Promise<ApiResponse<GetAllResponses[200], ThrowOnError>> {
      const { query, signal, path, throwOnError } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<GetAllResponses[200], ThrowOnError>(() =>
        datasourceEntriesApi.getAll({ client, path: { space_id: resolvedSpaceId }, query, signal, ...(throwOnError === undefined ? {} : { throwOnError }) }), throwOnError);
    },

    get<ThrowOnError extends boolean = false>(datasourceEntryId: number, options: { signal?: AbortSignal; throwOnError?: ThrowOnError } & SpaceIdPathOverride = {}): Promise<ApiResponse<GetResponses[200], ThrowOnError>> {
      const { signal, path, throwOnError } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<GetResponses[200], ThrowOnError>(() =>
        datasourceEntriesApi.get({
          client,
          path: { space_id: resolvedSpaceId, datasource_entry_id: datasourceEntryId },
          signal,
          ...(throwOnError === undefined ? {} : { throwOnError }),
        }), throwOnError);
    },

    create<ThrowOnError extends boolean = false>(options: { body: CreateData['body']; signal?: AbortSignal; throwOnError?: ThrowOnError } & SpaceIdPathOverride): Promise<ApiResponse<CreateResponses[201], ThrowOnError>> {
      const { body, signal, path, throwOnError } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<CreateResponses[201], ThrowOnError>(() =>
        datasourceEntriesApi.create({ client, path: { space_id: resolvedSpaceId }, body, signal, ...(throwOnError === undefined ? {} : { throwOnError }) }), throwOnError);
    },

    update<ThrowOnError extends boolean = false>(
      datasourceEntryId: number,
      options: { body: UpdateData['body']; signal?: AbortSignal; throwOnError?: ThrowOnError } & SpaceIdPathOverride,
    ): Promise<ApiResponse<UpdateResponses[200], ThrowOnError>> {
      const { body, signal, path, throwOnError } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<UpdateResponses[200], ThrowOnError>(() =>
        datasourceEntriesApi.update({
          client,
          path: { space_id: resolvedSpaceId, datasource_entry_id: datasourceEntryId },
          body,
          signal,
          ...(throwOnError === undefined ? {} : { throwOnError }),
        }), throwOnError);
    },
    remove<ThrowOnError extends boolean = false>(datasourceEntryId: number, options: { signal?: AbortSignal; throwOnError?: ThrowOnError } & SpaceIdPathOverride = {}): Promise<ApiResponse<void, ThrowOnError>> {
      const { signal, path, throwOnError } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<void, ThrowOnError>(() =>
        datasourceEntriesApi.remove({
          client,
          path: { space_id: resolvedSpaceId, datasource_entry_id: datasourceEntryId },
          signal,
          ...(throwOnError === undefined ? {} : { throwOnError }),
        }), throwOnError);
    },
  };
}
