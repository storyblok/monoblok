import { list as listTagsApi } from "../generated/tags/sdk.gen";
import type {
  ListData as TagsListData,
  ListResponses as TagsListResponses,
} from "../generated/tags/types.gen";
import type { ApiResponse, FetchOptions, ResourceDeps } from "../types";

export function createTagsResource(deps: ResourceDeps) {
  const { client, requestWithCache, asApiResponse, throttleManager } = deps;

  return {
    list: async <ThrowOnError extends boolean = false>(
      options: {
        query?: TagsListData["query"];
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } = {},
    ): Promise<ApiResponse<TagsListResponses[200], ThrowOnError>> => {
      const { query = {}, signal, throwOnError, fetchOptions } = options;
      const requestPath = "/v2/cdn/tags";
      return requestWithCache<TagsListResponses[200], ThrowOnError>(
        "GET",
        requestPath,
        query,
        (requestQuery: Record<string, unknown>) => {
          return throttleManager.execute(requestPath, requestQuery, () =>
            asApiResponse<TagsListResponses[200], ThrowOnError>(
              listTagsApi({
                client,
                query: requestQuery,
                signal,
                ...(throwOnError === undefined ? {} : { throwOnError }),
                ...(fetchOptions
                  ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } }
                  : {}),
              }),
            ),
          );
        },
      );
    },
  };
}
