import { searchCdnV2StrataIndex } from "../generated/capi/sdk.gen";
import type {
  SearchCdnV2StrataIndexData,
  SearchCdnV2StrataIndexResponses,
} from "../generated/capi/types.gen";
import type { ApiResponse, FetchOptions, ResourceDeps } from "../client";
import { STRATA_SEARCH_PATH } from "../utils/request";

/**
 * Query for `strata.search()`. The API answers a missing or blank `q` with an
 * empty result rather than an error, which would read as "no matches", so the
 * search term is required here.
 */
export type StrataSearchQuery = NonNullable<SearchCdnV2StrataIndexData["query"]> & { q: string };

export function createStrataResource<DefaultThrowOnError extends boolean = false>(
  deps: ResourceDeps<DefaultThrowOnError>,
) {
  const { client, requestWithCache, asApiResponse, throttleManager } = deps;

  return {
    /**
     * Search the space's content by meaning with Strata.
     *
     * Results are ranked best match first. Each hit is one matching piece of content, so a
     * story can appear more than once. Responses are never cached, by the API or by this
     * client. A public access token can search published content only.
     *
     * @example
     * ```ts
     * const { data } = await client.strata.search({ query: { q: 'pricing', limit: 10 } });
     * data?.results[0]?.story.slug;
     * ```
     */
    search: async <ThrowOnError extends boolean = DefaultThrowOnError>(options: {
      query: StrataSearchQuery;
      signal?: AbortSignal;
      throwOnError?: ThrowOnError;
      fetchOptions?: FetchOptions;
    }): Promise<ApiResponse<SearchCdnV2StrataIndexResponses[200], ThrowOnError>> => {
      const { query, signal, throwOnError, fetchOptions } = options;
      return requestWithCache<SearchCdnV2StrataIndexResponses[200], ThrowOnError>(
        "GET",
        STRATA_SEARCH_PATH,
        query,
        (requestQuery: Record<string, unknown>) => {
          return throttleManager.execute(STRATA_SEARCH_PATH, requestQuery, () =>
            asApiResponse<SearchCdnV2StrataIndexResponses[200], ThrowOnError>(
              searchCdnV2StrataIndex({
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
