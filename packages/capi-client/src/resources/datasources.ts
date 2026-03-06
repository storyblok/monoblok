import { getAll as getAllDatasourcesApi, get as getDatasourceApi } from '../generated/datasources/sdk.gen';
import type {
  GetAllData as DatasourcesGetAllData,
  GetAllResponses as DatasourcesGetAllResponses,
  GetData as DatasourcesGetData,
  GetResponses as DatasourcesGetResponses,
} from '../generated/datasources/types.gen';
import type { ApiResponse, ResourceDeps } from '../types';

export function createDatasourcesResource(deps: ResourceDeps) {
  const { client, requestWithCache, asApiResponse, throttleManager } = deps;

  return {
    get: async <ThrowOnError extends boolean = false>(
      id: DatasourcesGetData['path']['id'],
      options: { query?: DatasourcesGetData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError } = {},
    ): Promise<ApiResponse<DatasourcesGetResponses[200], ThrowOnError>> => {
      const { query = {}, signal, throwOnError } = options;
      const requestPath = `/v2/cdn/datasources/${id}`;
      return requestWithCache<DatasourcesGetResponses[200], ThrowOnError>('GET', requestPath, query, (requestQuery: Record<string, unknown>) => {
        return throttleManager.execute(requestPath, requestQuery, () =>
          asApiResponse<DatasourcesGetResponses[200], ThrowOnError>(getDatasourceApi({
            client,
            path: { id },
            query: requestQuery as DatasourcesGetData['query'], // bridge generic cache callback (Record<string, unknown>) to typed SDK query
            signal,
            ...(throwOnError === undefined ? {} : { throwOnError }),
          })));
      });
    },

    getAll: async <ThrowOnError extends boolean = false>(
      options: { query?: DatasourcesGetAllData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError } = {},
    ): Promise<ApiResponse<DatasourcesGetAllResponses[200], ThrowOnError>> => {
      const { query = {}, signal, throwOnError } = options;
      const requestPath = '/v2/cdn/datasources';
      return requestWithCache<DatasourcesGetAllResponses[200], ThrowOnError>('GET', requestPath, query, (requestQuery: Record<string, unknown>) => {
        return throttleManager.execute(requestPath, requestQuery, () =>
          asApiResponse<DatasourcesGetAllResponses[200], ThrowOnError>(getAllDatasourcesApi({
            client,
            query: requestQuery,
            signal,
            ...(throwOnError === undefined ? {} : { throwOnError }),
          })));
      });
    },
  };
}
