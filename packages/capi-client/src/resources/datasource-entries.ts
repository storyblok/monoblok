import { getAll as getAllDatasourceEntriesApi } from '../generated/datasource_entries/sdk.gen';
import type {
  GetAllData as DatasourceEntriesGetAllData,
  GetAllResponses as DatasourceEntriesGetAllResponses,
} from '../generated/datasource_entries/types.gen';
import type { ApiResponse, FetchOptions, ResourceDeps } from '../types';

export function createDatasourceEntriesResource(deps: ResourceDeps) {
  const { client, requestWithCache, asApiResponse, throttleManager } = deps;

  return {
    getAll: async <ThrowOnError extends boolean = false>(
      options: { query?: DatasourceEntriesGetAllData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } = {},
    ): Promise<ApiResponse<DatasourceEntriesGetAllResponses[200], ThrowOnError>> => {
      const { query = {}, signal, throwOnError, fetchOptions } = options;
      const requestPath = '/v2/cdn/datasource_entries';
      return requestWithCache<DatasourceEntriesGetAllResponses[200], ThrowOnError>('GET', requestPath, query, (requestQuery: Record<string, unknown>) => {
        return throttleManager.execute(requestPath, requestQuery, () =>
          asApiResponse<DatasourceEntriesGetAllResponses[200], ThrowOnError>(getAllDatasourceEntriesApi({
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
