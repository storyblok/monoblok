import { getDatasourceById, listDatasources } from "../generated/capi/sdk.gen";
import type {
  GetDatasourceByIdData,
  GetDatasourceByIdResponses,
  ListDatasourcesData,
  ListDatasourcesResponses,
} from "../generated/capi/types.gen";
import type { ApiResponse, FetchOptions, ResourceDeps } from "../client";
import { createPaginationMethods } from "../utils/paginate";

export function createDatasourcesResource<DefaultThrowOnError extends boolean = false>(
  deps: ResourceDeps<DefaultThrowOnError>,
) {
  const { client, requestWithCache, asApiResponse, throttleManager } = deps;

  const resource = {
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

    list: async <ThrowOnError extends boolean = DefaultThrowOnError>(
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
    getItems: (data) => data.datasources,
  });

  return {
    ...resource,

    /**
     * Walks every page of data sources, yielding one `list()` response per page. A failed page is
     * the last value yielded, so check `error` on each one. With `throwOnError`, it throws a
     * `PaginationError` instead.
     *
     * Published pages are pinned to the `cv` of the first page. If content changes mid-walk,
     * the walk fails with a `PaginationError` whose `page` restarts it. Draft pages, and pages
     * under `cache.cv: 'manual'`, are not pinned.
     */
    pages,

    /**
     * Walks every data source across all pages, fetching the next page while the current one is
     * consumed. A failed page throws a `PaginationError`.
     *
     * Published pages are pinned to the `cv` of the first page. If content changes mid-walk,
     * the walk fails with a `PaginationError` whose `page` restarts it. Draft pages, and pages
     * under `cache.cv: 'manual'`, are not pinned.
     */
    iterate,
  };
}
