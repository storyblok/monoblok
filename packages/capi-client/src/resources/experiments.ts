import { listCdnExperimentsV2 } from '../generated/capi/sdk.gen';
import type { ListCdnExperimentsV2Data, ListCdnExperimentsV2Responses } from '../generated/capi/types.gen';
import type { ApiResponse, FetchOptions, ResourceDeps } from '../client';

export function createExperimentsResource<DefaultThrowOnError extends boolean = false>(deps: ResourceDeps<DefaultThrowOnError>) {
  const { client, requestWithCache, asApiResponse, throttleManager } = deps;

  return {
    /**
     * Retrieve all running experiments for the space.
     *
     * Each experiment lists its variants and their `story_mappings`, which map an
     * `original_story_id`/`original_slug` to a `variant_story_id`/`variant_slug`.
     * The CDN has no per-story variant filter, so the typical flow is:
     *
     * 1. `experiments.list()` to fetch the running experiments.
     * 2. Pick a variant deterministically (e.g. hash the visitor id against the
     *    variant `public_id`/`weight`) for the experiment that maps the story you
     *    are rendering.
     * 3. Fetch that variant's own `variant_slug` via the `stories` resource (the
     *    control variant resolves back to the `original_slug`).
     *
     * See `@storyblok/experiments` for variant assignment and tracking helpers.
     */
    list: async <ThrowOnError extends boolean = DefaultThrowOnError>(
      options: { query?: ListCdnExperimentsV2Data['query']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } = {},
    ): Promise<ApiResponse<ListCdnExperimentsV2Responses[200], ThrowOnError>> => {
      const { query = {}, signal, throwOnError, fetchOptions } = options;
      const requestPath = '/v2/cdn/experiments';
      return requestWithCache<ListCdnExperimentsV2Responses[200], ThrowOnError>('GET', requestPath, query, (requestQuery: Record<string, unknown>) => {
        return throttleManager.execute(requestPath, requestQuery, () =>
          asApiResponse<ListCdnExperimentsV2Responses[200], ThrowOnError>(listCdnExperimentsV2({
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
