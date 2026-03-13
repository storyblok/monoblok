import { getAll as getAllTagsApi } from '../generated/tags/sdk.gen';
import type { GetAllData as TagsGetAllData, GetAllResponses as TagsGetAllResponses } from '../generated/tags/types.gen';
import type { ApiResponse, FetchOptions, ResourceDeps } from '../types';

export function createTagsResource(deps: ResourceDeps) {
  const { client, requestWithCache, asApiResponse, throttleManager } = deps;

  return {
    getAll: async <ThrowOnError extends boolean = false>(
      options: { query?: TagsGetAllData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } = {},
    ): Promise<ApiResponse<TagsGetAllResponses[200], ThrowOnError>> => {
      const { query = {}, signal, throwOnError, fetchOptions } = options;
      const requestPath = '/v2/cdn/tags';
      return requestWithCache<TagsGetAllResponses[200], ThrowOnError>('GET', requestPath, query, (requestQuery: Record<string, unknown>) => {
        return throttleManager.execute(requestPath, requestQuery, () =>
          asApiResponse<TagsGetAllResponses[200], ThrowOnError>(getAllTagsApi({
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
