import { getDatasourceById, listDatasources } from '../generated/capi/sdk.gen';
import type {
  GetDatasourceByIdData,
  GetDatasourceByIdResponses,
  ListDatasourcesData,
  ListDatasourcesResponses,
} from '../generated/capi/types.gen';
import type { ApiResponse, FetchOptions, ResourceDeps } from '../client';

export function createDatasourcesResource<DefaultThrowOnError extends boolean = false>(deps: ResourceDeps<DefaultThrowOnError>) {
  const { client, requestWithCache, asApiResponse, throttleManager } = deps;

  return {
    get: async <ThrowOnError extends boolean = DefaultThrowOnError>(
      id: GetDatasourceByIdData['path']['id'],
      options: { query?: GetDatasourceByIdData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } = {},
    ): Promise<ApiResponse<GetDatasourceByIdResponses[200], ThrowOnError>> => {
      const { query = {}, signal, throwOnError, fetchOptions } = options;
      const requestPath = `/v2/cdn/datasources/${id}`;
      return requestWithCache<GetDatasourceByIdResponses[200], ThrowOnError>('GET', requestPath, query ?? {}, (requestQuery: Record<string, unknown>) => {
        return throttleManager.execute(requestPath, requestQuery, () =>
          asApiResponse<GetDatasourceByIdResponses[200], ThrowOnError>(getDatasourceById({
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
      options: { query?: ListDatasourcesData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } = {},
    ): Promise<ApiResponse<ListDatasourcesResponses[200], ThrowOnError>> => {
      const { query = {}, signal, throwOnError, fetchOptions } = options;
      const requestPath = '/v2/cdn/datasources';
      return requestWithCache<ListDatasourcesResponses[200], ThrowOnError>('GET', requestPath, query, (requestQuery: Record<string, unknown>) => {
        return throttleManager.execute(requestPath, requestQuery, () =>
          asApiResponse<ListDatasourcesResponses[200], ThrowOnError>(listDatasources({
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
