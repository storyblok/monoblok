import { get as getSpaceApi } from '../generated/spaces/sdk.gen';
import type { GetResponses as SpacesGetResponses } from '../generated/spaces/types.gen';
import type { ApiResponse, FetchOptions, ResourceDeps } from '../types';

export function createSpacesResource(deps: ResourceDeps) {
  const { client, requestWithCache, asApiResponse, throttleManager } = deps;

  return {
    get: async <ThrowOnError extends boolean = false>(
      options: { signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } = {},
    ): Promise<ApiResponse<SpacesGetResponses[200], ThrowOnError>> => {
      const { signal, throwOnError, fetchOptions } = options;
      const requestPath = '/v2/cdn/spaces/me';
      return requestWithCache<SpacesGetResponses[200], ThrowOnError>('GET', requestPath, {}, (requestQuery: Record<string, unknown>) => {
        return throttleManager.execute(requestPath, requestQuery, () =>
          asApiResponse<SpacesGetResponses[200], ThrowOnError>(getSpaceApi({
            client,
            // The OpenAPI spec declares no query params so the generated type
            // is `query?: never`. At runtime we still need to pass a query object
            // because `setAuthParams` mutates it in-place to inject the `token`.
            query: requestQuery as never,
            signal,
            ...(throwOnError === undefined ? {} : { throwOnError }),
            ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}),
          })));
      });
    },
  };
}
