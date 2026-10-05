import { listDatasourceEntries } from "../generated/capi/sdk.gen";
import type {
  ListDatasourceEntriesData,
  ListDatasourceEntriesResponses,
} from "../generated/capi/types.gen";
import type { DatasourceEntry } from "../generated/capi/types-aliased.gen";
import type { ApiResponse, FetchOptions, ResourceDeps } from "../client";
import type { PageResult } from "../utils/paginate";
import { paginateItems, paginatePages } from "../utils/paginate";

export function createDatasourceEntriesResource<DefaultThrowOnError extends boolean = false>(
  deps: ResourceDeps<DefaultThrowOnError>,
) {
  const { client, requestWithCache, asApiResponse, throttleManager, cvMode } = deps;

  const list = async <ThrowOnError extends boolean = DefaultThrowOnError>(
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
  };

  type ListOptions<ThrowOnError extends boolean> = NonNullable<
    Parameters<typeof list<ThrowOnError>>[0]
  >;

  const toPaginateConfig = <ThrowOnError extends boolean>(options: ListOptions<ThrowOnError>) => ({
    query: { ...options.query },
    signal: options.signal,
    pinCv: cvMode !== "manual",
    fetchPage: (query: ListDatasourceEntriesData["query"], signal: AbortSignal) =>
      list({ ...options, query, signal, throwOnError: false }),
    getItems: (data: ListDatasourceEntriesResponses[200]) => data.datasource_entries,
  });

  return {
    list,

    /**
     * Walks every page of data source entries, yielding one `list()` response per page. A failed
     * page is the last value yielded, so check `error` on each one. With `throwOnError`, it throws
     * a `PaginationError` instead.
     *
     * Published pages are pinned to the `cv` of the first page, unless `cache.cv` is
     * `'manual'`. If a publish moves the edge past that snapshot mid-walk, the walk fails
     * with a `PaginationError` that restarts it from the first page.
     */
    pages: <ThrowOnError extends boolean = DefaultThrowOnError>(
      options: ListOptions<ThrowOnError> = {},
    ): AsyncGenerator<
      PageResult<ListDatasourceEntriesResponses[200], ThrowOnError>,
      void,
      undefined
    > =>
      paginatePages(
        toPaginateConfig(options),
        options.throwOnError,
        client.getConfig().throwOnError ?? false,
      ),

    /**
     * Walks every data source entry across all pages, fetching the next page while the current one
     * is consumed. A failed page throws a `PaginationError`.
     *
     * Published pages are pinned to the `cv` of the first page, unless `cache.cv` is
     * `'manual'`. If a publish moves the edge past that snapshot mid-walk, the walk fails
     * with a `PaginationError` that restarts it from the first page.
     */
    iterate: (
      options: Omit<ListOptions<boolean>, "throwOnError"> = {},
    ): AsyncGenerator<DatasourceEntry, void, undefined> => paginateItems(toPaginateConfig(options)),
  };
}
