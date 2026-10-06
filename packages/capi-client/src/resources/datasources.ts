import { getDatasourceById, listDatasources } from "../generated/capi/sdk.gen";
import type {
  GetDatasourceByIdData,
  GetDatasourceByIdResponses,
  ListDatasourcesData,
  ListDatasourcesResponses,
} from "../generated/capi/types.gen";
import type { Datasource } from "../generated/capi/types-aliased.gen";
import type { ApiResponse, FetchOptions, ResourceDeps } from "../client";
import type { PageResult } from "../utils/paginate";
import { paginateItems, paginatePages } from "../utils/paginate";

export function createDatasourcesResource<DefaultThrowOnError extends boolean = false>(
  deps: ResourceDeps<DefaultThrowOnError>,
) {
  const { client, requestWithCache, asApiResponse, throttleManager, cvMode } = deps;

  const list = async <ThrowOnError extends boolean = DefaultThrowOnError>(
    options: {
      query?: ListDatasourcesData["query"];
      signal?: AbortSignal;
      throwOnError?: ThrowOnError;
      fetchOptions?: FetchOptions;
    } = {},
  ): Promise<ApiResponse<ListDatasourcesResponses[200], ThrowOnError>> => {
    const { query = {}, signal, throwOnError, fetchOptions } = options;
    const requestPath = "/v2/cdn/datasources";
    return requestWithCache<ListDatasourcesResponses[200], ThrowOnError>(
      "GET",
      requestPath,
      query,
      (requestQuery: Record<string, unknown>) => {
        return throttleManager.execute(requestPath, requestQuery, () =>
          asApiResponse<ListDatasourcesResponses[200], ThrowOnError>(
            listDatasources({
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
    fetchPage: (query: ListDatasourcesData["query"], signal: AbortSignal) =>
      list({ ...options, query, signal, throwOnError: false }),
    getItems: (data: ListDatasourcesResponses[200]) => data.datasources,
  });

  return {
    get: async <ThrowOnError extends boolean = DefaultThrowOnError>(
      id: GetDatasourceByIdData["path"]["id"],
      options: {
        query?: GetDatasourceByIdData["query"];
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } = {},
    ): Promise<ApiResponse<GetDatasourceByIdResponses[200], ThrowOnError>> => {
      const { query = {}, signal, throwOnError, fetchOptions } = options;
      const requestPath = `/v2/cdn/datasources/${id}`;
      return requestWithCache<GetDatasourceByIdResponses[200], ThrowOnError>(
        "GET",
        requestPath,
        query ?? {},
        (requestQuery: Record<string, unknown>) => {
          return throttleManager.execute(requestPath, requestQuery, () =>
            asApiResponse<GetDatasourceByIdResponses[200], ThrowOnError>(
              getDatasourceById({
                client,
                path: { id },
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

    list,

    /**
     * Walks every page of data sources, yielding one `list()` response per page. A failed page
     * is the last value yielded, so check `error` on each one. With `throwOnError`, it
     * throws a `PaginationError` instead.
     *
     * Published pages are pinned to the `cv` of the first page, unless `cache.cv` is
     * `'manual'`. If a publish moves the edge past that snapshot mid-walk, the walk fails
     * with a `PaginationError` that restarts it from the first page.
     */
    pages: <ThrowOnError extends boolean = DefaultThrowOnError>(
      options: ListOptions<ThrowOnError> = {},
    ): AsyncGenerator<PageResult<ListDatasourcesResponses[200], ThrowOnError>, void, undefined> =>
      paginatePages(
        toPaginateConfig(options),
        options.throwOnError,
        client.getConfig().throwOnError ?? false,
      ),

    /**
     * Walks every data source across all pages, fetching the next page while the current one
     * is consumed. A failed page throws a `PaginationError`.
     *
     * Published pages are pinned to the `cv` of the first page, unless `cache.cv` is
     * `'manual'`. If a publish moves the edge past that snapshot mid-walk, the walk fails
     * with a `PaginationError` that restarts it from the first page.
     */
    iterate: (
      options: Omit<ListOptions<boolean>, "throwOnError"> = {},
    ): AsyncGenerator<Datasource, void, undefined> => paginateItems(toPaginateConfig(options)),
  };
}
