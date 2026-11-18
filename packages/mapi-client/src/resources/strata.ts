import * as mapi from "../generated/mapi/sdk.gen";
import type {
  SearchStrataIndexData,
  SearchStrataIndexResponses,
} from "../generated/mapi/types.gen";
import type { ApiResponse, FetchOptions, MapiResourceDeps } from "../client";
import { resolveSpaceId, type SpaceIdPathOverride } from "./shared";

/**
 * Query for `strata.search()`. The API answers a missing or blank `q` with an
 * empty result rather than an error, which would read as "no matches", so the
 * search term is required here.
 */
export type StrataSearchQuery = NonNullable<SearchStrataIndexData["query"]> & { q: string };

export function createStrataResource<DefaultThrowOnError extends boolean = false>(
  deps: MapiResourceDeps<DefaultThrowOnError>,
) {
  const { client, spaceId, wrapRequest } = deps;

  return {
    /**
     * Search the space's content by meaning with Strata.
     *
     * Runs as the authenticated user, so results only include stories the user
     * can read. Results are ranked best match first. Each hit is one matching
     * piece of content, so a story can appear more than once.
     *
     * @example
     * ```ts
     * const { data } = await client.strata.search({ query: { q: 'pricing', version: 'draft' } });
     * data?.results[0]?.story.slug;
     * ```
     */
    search<ThrowOnError extends boolean = DefaultThrowOnError>(
      options: {
        query: StrataSearchQuery;
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } & SpaceIdPathOverride,
    ): Promise<ApiResponse<SearchStrataIndexResponses[200], ThrowOnError>> {
      const { query, signal, path, throwOnError, fetchOptions } = options;
      return wrapRequest<SearchStrataIndexResponses[200], ThrowOnError>(
        () =>
          mapi.searchStrataIndex({
            client,
            path: { space_id: resolveSpaceId(spaceId, path) },
            query,
            signal,
            ...(throwOnError === undefined ? {} : { throwOnError }),
            ...(fetchOptions
              ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } }
              : {}),
          }),
        throwOnError,
      );
    },
  };
}
