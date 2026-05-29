import { listLinks } from '../generated/capi/sdk.gen';
import type { ListLinksData, ListLinksResponses } from '../generated/capi/types.gen';
import type { ApiResponse, FetchOptions, ResourceDeps } from '../client';

export function createLinksResource<DefaultThrowOnError extends boolean = false>(deps: ResourceDeps<DefaultThrowOnError>) {
  const { client, requestWithCache, asApiResponse, throttleManager } = deps;

  return {
    list: async <ThrowOnError extends boolean = DefaultThrowOnError>(
      options: { query?: ListLinksData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } = {},
    ): Promise<ApiResponse<ListLinksResponses[200], ThrowOnError>> => {
      const { query = {}, signal, throwOnError, fetchOptions } = options;
      const requestPath = '/v2/cdn/links';
      return requestWithCache<ListLinksResponses[200], ThrowOnError>('GET', requestPath, query, (requestQuery: Record<string, unknown>) => {
        return throttleManager.execute(requestPath, requestQuery, () =>
          asApiResponse<ListLinksResponses[200], ThrowOnError>(listLinks({
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
