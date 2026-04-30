import {
  get as getDatasourceApi,
  list as listDatasourcesApi,
} from "../generated/datasources/sdk.gen";
import type {
  GetData as DatasourcesGetData,
  GetResponses as DatasourcesGetResponses,
  ListData as DatasourcesListData,
  ListResponses as DatasourcesListResponses,
} from "../generated/datasources/types.gen";
import type { ApiResponse, FetchOptions, ResourceDeps } from "../types";

export function createDatasourcesResource(deps: ResourceDeps) {
  const { client, requestWithCache, asApiResponse, throttleManager } = deps;

  return {
    get: async <ThrowOnError extends boolean = false>(
      id: DatasourcesGetData["path"]["id"],
      options: {
        query?: DatasourcesGetData["query"];
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } = {},
    ): Promise<ApiResponse<DatasourcesGetResponses[200], ThrowOnError>> => {
      const { query = {}, signal, throwOnError, fetchOptions } = options;
      const requestPath = `/v2/cdn/datasources/${id}`;
      return requestWithCache<DatasourcesGetResponses[200], ThrowOnError>(
        "GET",
        requestPath,
        query,
        (requestQuery: Record<string, unknown>) => {
          return throttleManager.execute(requestPath, requestQuery, () =>
            asApiResponse<DatasourcesGetResponses[200], ThrowOnError>(
              getDatasourceApi({
                client,
                path: { id },
                query: requestQuery as DatasourcesGetData["query"], // bridge generic cache callback (Record<string, unknown>) to typed SDK query
                signal,
                ...(throwOnError === undefined ? {} : { throwOnError }),
                ...(fetchOptions
                  ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } }
                  : {}),
              }),
            ),
          );
        },
      );
    },

    list: async <ThrowOnError extends boolean = false>(
      options: {
        query?: DatasourcesListData["query"];
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } = {},
    ): Promise<ApiResponse<DatasourcesListResponses[200], ThrowOnError>> => {
      const { query = {}, signal, throwOnError, fetchOptions } = options;
      const requestPath = "/v2/cdn/datasources";
      return requestWithCache<DatasourcesListResponses[200], ThrowOnError>(
        "GET",
        requestPath,
        query,
        (requestQuery: Record<string, unknown>) => {
          return throttleManager.execute(requestPath, requestQuery, () =>
            asApiResponse<DatasourcesListResponses[200], ThrowOnError>(
              listDatasourcesApi({
                client,
                query: requestQuery,
                signal,
                ...(throwOnError === undefined ? {} : { throwOnError }),
                ...(fetchOptions
                  ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } }
                  : {}),
              }),
            ),
          );
        },
      );
    },
  };
}
