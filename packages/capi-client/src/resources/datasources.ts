import { getDatasourceById, listDatasources } from '../generated/capi/sdk.gen';
import type {
  GetDatasourceByIdData as DatasourcesGetData,
  GetDatasourceByIdResponses as DatasourcesGetResponses,
  ListDatasourcesData as DatasourcesListData,
  ListDatasourcesResponses as DatasourcesListResponses,
} from '../generated/capi/types.gen';
import type { ApiResponse, FetchOptions, ResourceDeps } from '../client';

export function createDatasourcesResource<DefaultThrowOnError extends boolean = false>(deps: ResourceDeps<DefaultThrowOnError>) {
  const { client, requestWithCache, asApiResponse, throttleManager } = deps;

  return {
    get: async <ThrowOnError extends boolean = DefaultThrowOnError>(
      id: DatasourcesGetData['path']['id'],
      options: { query?: DatasourcesGetData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } = {},
    ): Promise<ApiResponse<DatasourcesGetResponses[200], ThrowOnError>> => {
      const { query = {}, signal, throwOnError, fetchOptions } = options;
      const requestPath = `/v2/cdn/datasources/${id}`;
      return requestWithCache<DatasourcesGetResponses[200], ThrowOnError>('GET', requestPath, query ?? {}, (requestQuery: Record<string, unknown>) => {
        return throttleManager.execute(requestPath, requestQuery, () =>
          asApiResponse<DatasourcesGetResponses[200], ThrowOnError>(getDatasourceById({
            client,
            path: { id },
            query: requestQuery,
            signal,
            ...(throwOnError === undefined ? {} : { throwOnError }),
            ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}),
          })));
      });
    },

    list: async <ThrowOnError extends boolean = DefaultThrowOnError>(
      options: { query?: DatasourcesListData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } = {},
    ): Promise<ApiResponse<DatasourcesListResponses[200], ThrowOnError>> => {
      const { query = {}, signal, throwOnError, fetchOptions } = options;
      const requestPath = '/v2/cdn/datasources';
      return requestWithCache<DatasourcesListResponses[200], ThrowOnError>('GET', requestPath, query, (requestQuery: Record<string, unknown>) => {
        return throttleManager.execute(requestPath, requestQuery, () =>
          asApiResponse<DatasourcesListResponses[200], ThrowOnError>(listDatasources({
            client,
            query: requestQuery,
            signal,
            ...(throwOnError === undefined ? {} : { throwOnError }),
            ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}),
          })));
      });
    },
  };
}
