import { getAll as getAllLinks } from '../generated/links/sdk.gen';
import type { GetAllData as LinksGetAllData, GetAllResponses as LinksGetAllResponses } from '../generated/links/types.gen';
import type { ApiResponse, ResourceDeps } from '../types';

export function createLinksResource(deps: ResourceDeps) {
  const { client, requestWithCache, asApiResponse } = deps;

  return {
    getAll: async <ThrowOnError extends boolean = false>(
      options: { query?: LinksGetAllData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError } = {},
    ): Promise<ApiResponse<LinksGetAllResponses[200], ThrowOnError>> => {
      const { query = {}, signal, throwOnError } = options;
      const requestPath = '/v2/cdn/links';
      return requestWithCache<LinksGetAllResponses[200], ThrowOnError>('GET', requestPath, query, (requestQuery: Record<string, unknown>) => {
        return asApiResponse<LinksGetAllResponses[200], ThrowOnError>(getAllLinks({
          client,
          query: requestQuery,
          signal,
          ...(throwOnError === undefined ? {} : { throwOnError }),
        }));
      });
    },
  };
}
