import { getAll as getAllDatasourceEntriesApi } from '../generated/datasource_entries/sdk.gen';
import type {
  GetAllData as DatasourceEntriesGetAllData,
  GetAllResponses as DatasourceEntriesGetAllResponses,
} from '../generated/datasource_entries/types.gen';
import type { ApiResponse, ResourceDeps } from '../types';

export function createDatasourceEntriesResource(deps: ResourceDeps) {
  const { client, requestWithCache, asApiResponse } = deps;

  return {
    getAll: async <ThrowOnError extends boolean = false>(
      options: { query?: DatasourceEntriesGetAllData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError } = {},
    ): Promise<ApiResponse<DatasourceEntriesGetAllResponses[200], ThrowOnError>> => {
      const { query = {}, signal, throwOnError } = options;
      const requestPath = '/v2/cdn/datasource_entries';
      return requestWithCache<DatasourceEntriesGetAllResponses[200], ThrowOnError>('GET', requestPath, query, (requestQuery: Record<string, unknown>) => {
        return asApiResponse<DatasourceEntriesGetAllResponses[200], ThrowOnError>(getAllDatasourceEntriesApi({
          client,
          query: requestQuery,
          signal,
          ...(throwOnError === undefined ? {} : { throwOnError }),
        }));
      });
    },
  };
}
