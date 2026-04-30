import * as datasourcesApi from "../generated/datasources/sdk.gen";
import type {
  CreateData,
  CreateResponses,
  GetResponses,
  ListData,
  ListResponses,
  UpdateData,
  UpdateResponses,
} from "../generated/datasources/types.gen";
import type { ApiResponse, FetchOptions, MapiResourceDeps } from "../index";
import { resolveSpaceId, type SpaceIdPathOverride } from "./shared";

export function createDatasourcesResource(deps: MapiResourceDeps) {
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
          datasourcesApi.list({
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
      datasourceId: number,
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
          datasourcesApi.get({
            client,
            path: { space_id: resolvedSpaceId, datasource_id: datasourceId },
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
          datasourcesApi.create({
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
      datasourceId: number,
      options: {
        body: UpdateData["body"];
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } & SpaceIdPathOverride,
    ): Promise<ApiResponse<UpdateResponses[200], ThrowOnError>> {
      const { body, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<UpdateResponses[200], ThrowOnError>(
        () =>
          datasourcesApi.update({
            client,
            path: { space_id: resolvedSpaceId, datasource_id: datasourceId },
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
      datasourceId: number,
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
          datasourcesApi.delete_({
            client,
            path: { space_id: resolvedSpaceId, datasource_id: datasourceId },
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
