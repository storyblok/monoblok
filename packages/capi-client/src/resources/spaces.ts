import { get as getSpaceApi } from '../generated/spaces/sdk.gen';
import type { GetResponses as SpacesGetResponses } from '../generated/spaces/types.gen';
import type { ApiResponse, ResourceDeps } from '../types';

export function createSpacesResource(deps: ResourceDeps) {
  const { client, requestWithCache, asApiResponse } = deps;

  return {
    get: async <ThrowOnError extends boolean = false>(
      options: { signal?: AbortSignal; throwOnError?: ThrowOnError } = {},
    ): Promise<ApiResponse<SpacesGetResponses[200], ThrowOnError>> => {
      const { signal, throwOnError } = options;
      const requestPath = '/v2/cdn/spaces/me';
      return requestWithCache<SpacesGetResponses[200], ThrowOnError>('GET', requestPath, {}, () => {
        return asApiResponse<SpacesGetResponses[200], ThrowOnError>(getSpaceApi({
          client,
          signal,
          ...(throwOnError === undefined ? {} : { throwOnError }),
        }));
      });
    },
  };
}
