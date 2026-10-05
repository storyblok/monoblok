import { listLinks } from "../generated/capi/sdk.gen";
import type { Link } from "../generated/capi/types-aliased.gen";
import type { ListLinksData, ListLinksResponses } from "../generated/capi/types.gen";
import type { ApiResponse, FetchOptions, ResourceDeps } from "../client";
import type { PageResult } from "../utils/paginate";
import { paginateItems, paginatePages } from "../utils/paginate";

export function createLinksResource<DefaultThrowOnError extends boolean = false>(
  deps: ResourceDeps<DefaultThrowOnError>,
) {
  const { client, requestWithCache, asApiResponse, throttleManager, cvMode } = deps;

  const list = async <ThrowOnError extends boolean = DefaultThrowOnError>(
    options: {
      query?: ListLinksData["query"];
      signal?: AbortSignal;
      throwOnError?: ThrowOnError;
      fetchOptions?: FetchOptions;
    } = {},
  ): Promise<ApiResponse<ListLinksResponses[200], ThrowOnError>> => {
    const { query = {}, signal, throwOnError, fetchOptions } = options;
    const requestPath = "/v2/cdn/links";
    return requestWithCache<ListLinksResponses[200], ThrowOnError>(
      "GET",
      requestPath,
      query,
      (requestQuery: Record<string, unknown>) => {
        return throttleManager.execute(requestPath, requestQuery, () =>
          asApiResponse<ListLinksResponses[200], ThrowOnError>(
            listLinks({
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
    // `/cdn/links` ignores `page` unless pagination is switched on.
    query: { ...options.query, paginated: "1" },
    signal: options.signal,
    pinCv: cvMode !== "manual",
    fetchPage: (query: ListLinksData["query"], signal: AbortSignal) =>
      list({ ...options, query, signal, throwOnError: false }),
    getItems: (data: ListLinksResponses[200]) => Object.values(data.links),
  });

  return {
    list,

    /**
     * Walks every page of links, yielding one `list()` response per page. A failed page is
     * the last value yielded, so check `error` on each one. With `throwOnError`, it
     * throws a `PaginationError` instead.
     */
    pages: <ThrowOnError extends boolean = DefaultThrowOnError>(
      options: ListOptions<ThrowOnError> = {},
    ): AsyncGenerator<PageResult<ListLinksResponses[200], ThrowOnError>, void, undefined> =>
      paginatePages(
        toPaginateConfig(options),
        options.throwOnError,
        client.getConfig().throwOnError ?? false,
      ),

    /**
     * Walks every link across all pages, fetching the next page while the current one is
     * consumed. A failed page throws a `PaginationError`.
     */
    iterate: (
      options: Omit<ListOptions<boolean>, "throwOnError"> = {},
    ): AsyncGenerator<Link, void, undefined> => paginateItems(toPaginateConfig(options)),
  };
}
