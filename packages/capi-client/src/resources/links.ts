import { list as listLinks } from '../generated/links/sdk.gen';
import type { ListData as LinksListData, ListResponses as LinksListResponses } from '../generated/links/types.gen';
import type { ApiResponse, FetchOptions, ResourceDeps } from '../types';

export function createLinksResource(deps: ResourceDeps) {
  const { client, requestWithCache, asApiResponse, throttleManager } = deps;

  return {
    list: async <ThrowOnError extends boolean = false>(
      options: { query?: LinksListData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } = {},
    ): Promise<ApiResponse<LinksListResponses[200], ThrowOnError>> => {
      const { query = {}, signal, throwOnError, fetchOptions } = options;
      const requestPath = '/v2/cdn/links';
      return requestWithCache<LinksListResponses[200], ThrowOnError>('GET', requestPath, query, (requestQuery: Record<string, unknown>) => {
        return throttleManager.execute(requestPath, requestQuery, () =>
          asApiResponse<LinksListResponses[200], ThrowOnError>(listLinks({
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
