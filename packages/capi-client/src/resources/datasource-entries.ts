import { list as listDatasourceEntriesApi } from '../generated/datasource_entries/sdk.gen';
import type {
  ListData as DatasourceEntriesListData,
  ListResponses as DatasourceEntriesListResponses,
} from '../generated/datasource_entries/types.gen';
import type { ApiResponse, FetchOptions, ResourceDeps } from '../client';

export function createDatasourceEntriesResource<DefaultThrowOnError extends boolean = false>(deps: ResourceDeps<DefaultThrowOnError>) {
  const { client, requestWithCache, asApiResponse, throttleManager } = deps;

  return {
    list: async <ThrowOnError extends boolean = DefaultThrowOnError>(
      options: { query?: DatasourceEntriesListData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } = {},
    ): Promise<ApiResponse<DatasourceEntriesListResponses[200], ThrowOnError>> => {
      const { query = {}, signal, throwOnError, fetchOptions } = options;
      const requestPath = '/v2/cdn/datasource_entries';
      return requestWithCache<DatasourceEntriesListResponses[200], ThrowOnError>('GET', requestPath, query, (requestQuery: Record<string, unknown>) => {
        return throttleManager.execute(requestPath, requestQuery, () =>
          asApiResponse<DatasourceEntriesListResponses[200], ThrowOnError>(listDatasourceEntriesApi({
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
