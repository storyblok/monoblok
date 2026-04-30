import * as datasourceEntriesApi from "../generated/datasource_entries/sdk.gen";
import type {
  CreateData,
  CreateResponses,
  GetResponses,
  ListData,
  ListResponses,
  UpdateData,
} from "../generated/datasource_entries/types.gen";
import type { ApiResponse, FetchOptions, MapiResourceDeps } from "../index";
import { resolveSpaceId, type SpaceIdPathOverride } from "./shared";

export function createDatasourceEntriesResource(deps: MapiResourceDeps) {
  const { client, spaceId, wrapRequest } = deps;
  const getSpaceId = (path?: SpaceIdPathOverride["path"]) => resolveSpaceId(spaceId, path);

  return {
    list<ThrowOnError extends boolean = false>(
      options: {
        query?: ListData["query"];
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } & SpaceIdPathOverride = {},
    ): Promise<ApiResponse<ListResponses[200], ThrowOnError>> {
      const { query, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<ListResponses[200], ThrowOnError>(
        () =>
          datasourceEntriesApi.list({
            client,
            path: { space_id: resolvedSpaceId },
            query,
            signal,
            ...(throwOnError === undefined ? {} : { throwOnError }),
            ...(fetchOptions
              ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } }
              : {}),
          }),
        throwOnError,
      );
    },

    get<ThrowOnError extends boolean = false>(
      datasourceEntryId: number,
      options: {
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } & SpaceIdPathOverride = {},
    ): Promise<ApiResponse<GetResponses[200], ThrowOnError>> {
      const { signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<GetResponses[200], ThrowOnError>(
        () =>
          datasourceEntriesApi.get({
            client,
            path: { space_id: resolvedSpaceId, datasource_entry_id: datasourceEntryId },
            signal,
            ...(throwOnError === undefined ? {} : { throwOnError }),
            ...(fetchOptions
              ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } }
              : {}),
          }),
        throwOnError,
      );
    },

    create<ThrowOnError extends boolean = false>(
      options: {
        body: CreateData["body"];
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } & SpaceIdPathOverride,
    ): Promise<ApiResponse<CreateResponses[201], ThrowOnError>> {
      const { body, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<CreateResponses[201], ThrowOnError>(
        () =>
          datasourceEntriesApi.create({
            client,
            path: { space_id: resolvedSpaceId },
            body,
            signal,
            ...(throwOnError === undefined ? {} : { throwOnError }),
            ...(fetchOptions
              ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } }
              : {}),
          }),
        throwOnError,
      );
    },

    update<ThrowOnError extends boolean = false>(
      datasourceEntryId: number,
      options: {
        body: UpdateData["body"];
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } & SpaceIdPathOverride,
    ): Promise<ApiResponse<void, ThrowOnError>> {
      const { body, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<void, ThrowOnError>(
        () =>
          datasourceEntriesApi.update({
            client,
            path: { space_id: resolvedSpaceId, datasource_entry_id: datasourceEntryId },
            body,
            signal,
            ...(throwOnError === undefined ? {} : { throwOnError }),
            ...(fetchOptions
              ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } }
              : {}),
          }),
        throwOnError,
      );
    },
    delete<ThrowOnError extends boolean = false>(
      datasourceEntryId: number,
      options: {
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } & SpaceIdPathOverride = {},
    ): Promise<ApiResponse<void, ThrowOnError>> {
      const { signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<void, ThrowOnError>(
        () =>
          datasourceEntriesApi.delete_({
            client,
            path: { space_id: resolvedSpaceId, datasource_entry_id: datasourceEntryId },
            signal,
            ...(throwOnError === undefined ? {} : { throwOnError }),
            ...(fetchOptions
              ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } }
              : {}),
          }),
        throwOnError,
      );
    },
  };
}
