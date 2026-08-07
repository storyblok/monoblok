import { getSpace as getSpaceApi } from '../generated/capi/sdk.gen';
import type { GetSpaceData, GetSpaceResponses } from '../generated/capi/types.gen';
import type { ApiResponse, FetchOptions, ResourceDeps } from '../client';

export function createSpacesResource<DefaultThrowOnError extends boolean = false>(deps: ResourceDeps<DefaultThrowOnError>) {
  const { client, requestWithCache, asApiResponse, throttleManager } = deps;

  return {
    get: async <ThrowOnError extends boolean = DefaultThrowOnError>(
      options: { query?: GetSpaceData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } = {},
    ): Promise<ApiResponse<GetSpaceResponses[200], ThrowOnError>> => {
      const { query = {}, signal, throwOnError, fetchOptions } = options;
      const requestPath = '/v2/cdn/spaces/me';
      return requestWithCache<GetSpaceResponses[200], ThrowOnError>('GET', requestPath, query, (requestQuery: Record<string, unknown>) => {
        return throttleManager.execute(requestPath, requestQuery, () =>
          asApiResponse<GetSpaceResponses[200], ThrowOnError>(getSpaceApi({
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
