import { listDatasourceEntries } from "../generated/capi/sdk.gen";
import type {
  ListDatasourceEntriesData,
  ListDatasourceEntriesResponses,
} from "../generated/capi/types.gen";
import type { ApiResponse, FetchOptions, ResourceDeps } from "../client";
import { createPaginationMethods } from "../utils/paginate";

export function createDatasourceEntriesResource<DefaultThrowOnError extends boolean = false>(
  deps: ResourceDeps<DefaultThrowOnError>,
) {
  const { client, requestWithCache, asApiResponse, throttleManager } = deps;

  const resource = {
    list: async <ThrowOnError extends boolean = DefaultThrowOnError>(
      options: {
        query?: ListDatasourceEntriesData["query"];
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } = {},
    ): Promise<ApiResponse<ListDatasourceEntriesResponses[200], ThrowOnError>> => {
      const { query = {}, signal, throwOnError, fetchOptions } = options;
      const requestPath = "/v2/cdn/datasource_entries";
      return requestWithCache<ListDatasourceEntriesResponses[200], ThrowOnError>(
        "GET",
        requestPath,
        query,
        (requestQuery: Record<string, unknown>) => {
          return throttleManager.execute(requestPath, requestQuery, () =>
            asApiResponse<ListDatasourceEntriesResponses[200], ThrowOnError>(
              listDatasourceEntries({
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

  type ListOptions = Omit<NonNullable<Parameters<typeof resource.list>[0]>, "throwOnError">;

  const { pages, iterate } = createPaginationMethods(deps, {
    fetchPage: (options: ListOptions | undefined, pageQuery, signal) =>
      resource.list({
        ...options,
        query: { ...options?.query, ...pageQuery },
        signal,
        throwOnError: false,
      }),
    getItems: (data) => data.datasource_entries,
  });

  return {
    ...resource,

    /**
     * Walks every page of data source entries, yielding one `list()` response per page. A failed page is
     * the last value yielded, so check `error` on each one. With `throwOnError`, it throws a
     * `PaginationError` instead.
     *
     * Published pages are pinned to the `cv` of the first page. If content changes mid-walk,
     * the walk fails with a `PaginationError` whose `page` restarts it. Draft pages, and pages
     * under `cache.cv: 'manual'`, are not pinned.
     */
    pages,

    /**
     * Walks every data source entry across all pages, fetching the next page while the current one is
     * consumed. A failed page throws a `PaginationError`.
     *
     * Published pages are pinned to the `cv` of the first page. If content changes mid-walk,
     * the walk fails with a `PaginationError` whose `page` restarts it. Draft pages, and pages
     * under `cache.cv: 'manual'`, are not pinned.
     */
    iterate,
  };
}
