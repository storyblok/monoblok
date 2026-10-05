import * as mapi from "../generated/mapi/sdk.gen";
import type {
  CreateDatasourceEntryData,
  CreateDatasourceEntryResponses,
  DatasourceEntriesIndexResponse,
  GetDatasourceEntryResponses,
  ListDatasourceEntriesData,
  PartialUpdateDatasourceEntryData,
  PartialUpdateDatasourceEntryResponses,
  ReplaceDatasourceEntryData,
  ReplaceDatasourceEntryResponses,
} from "../generated/mapi/types.gen";
import type { ApiResponse, FetchOptions, MapiResourceDeps } from "../client";
import type { PageResult } from "../utils/paginate";
import { paginateItems, paginatePages } from "../utils/paginate";
import { buildCallOptions, resolveSpaceId, type SpaceIdPathOverride } from "./shared";

export function createDatasourceEntriesResource<DefaultThrowOnError extends boolean = false>(
  deps: MapiResourceDeps<DefaultThrowOnError>,
) {
  const { client, spaceId, wrapRequest } = deps;
  const getSpaceId = (path?: SpaceIdPathOverride["path"]) => resolveSpaceId(spaceId, path);

  const resource = {
    list<ThrowOnError extends boolean = DefaultThrowOnError>(
      options: {
        query?: ListDatasourceEntriesData["query"];
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } & SpaceIdPathOverride = {},
    ): Promise<ApiResponse<DatasourceEntriesIndexResponse, ThrowOnError>> {
      const { query, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<DatasourceEntriesIndexResponse, ThrowOnError>(
        () =>
          mapi.listDatasourceEntries({
            client,
            path: { space_id: resolvedSpaceId },
            query,
            signal,
            ...buildCallOptions(client, throwOnError, fetchOptions),
          }),
        throwOnError,
      );
    },

    get<ThrowOnError extends boolean = DefaultThrowOnError>(
      datasourceEntryId: number,
      options: {
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } & SpaceIdPathOverride = {},
    ): Promise<ApiResponse<GetDatasourceEntryResponses[200], ThrowOnError>> {
      const { signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<GetDatasourceEntryResponses[200], ThrowOnError>(
        () =>
          mapi.getDatasourceEntry({
            client,
            path: { space_id: resolvedSpaceId, id: datasourceEntryId },
            signal,
            ...buildCallOptions(client, throwOnError, fetchOptions),
          }),
        throwOnError,
      );
    },

    create<ThrowOnError extends boolean = DefaultThrowOnError>(
      options: {
        body: CreateDatasourceEntryData["body"];
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } & SpaceIdPathOverride,
    ): Promise<ApiResponse<CreateDatasourceEntryResponses[201], ThrowOnError>> {
      const { body, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<CreateDatasourceEntryResponses[201], ThrowOnError>(
        () =>
          mapi.createDatasourceEntry({
            client,
            path: { space_id: resolvedSpaceId },
            body,
            signal,
            ...buildCallOptions(client, throwOnError, fetchOptions),
          }),
        throwOnError,
      );
    },

    /**
     * PATCH /datasource_entries/{id}: partial update.
     */
    update<ThrowOnError extends boolean = DefaultThrowOnError>(
      datasourceEntryId: number,
      options: {
        body: PartialUpdateDatasourceEntryData["body"];
        query?: { dimension_id?: number };
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } & SpaceIdPathOverride,
    ): Promise<ApiResponse<PartialUpdateDatasourceEntryResponses[204], ThrowOnError>> {
      const { body, query, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<PartialUpdateDatasourceEntryResponses[204], ThrowOnError>(
        () =>
          mapi.partialUpdateDatasourceEntry({
            client,
            path: { space_id: resolvedSpaceId, id: datasourceEntryId },
            body,
            // The update endpoint accepts a `dimension_id` query param to write a
            // per-dimension child value, but it is not modeled in the OpenAPI spec
            // yet (generated `PartialUpdateDatasourceEntryData['query']` is
            // `never`). The generated SDK
            // forwards `query` verbatim, so pass it through with a localized cast.
            ...(query ? ({ query } as { query: never }) : {}),
            signal,
            ...buildCallOptions(client, throwOnError, fetchOptions),
          }),
        throwOnError,
      );
    },
    /**
     * PUT /datasource_entries/{id}: full replace.
     */
    replace<ThrowOnError extends boolean = DefaultThrowOnError>(
      datasourceEntryId: number,
      options: {
        body: ReplaceDatasourceEntryData["body"];
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } & SpaceIdPathOverride,
    ): Promise<ApiResponse<ReplaceDatasourceEntryResponses[204], ThrowOnError>> {
      const { body, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<ReplaceDatasourceEntryResponses[204], ThrowOnError>(
        () =>
          mapi.replaceDatasourceEntry({
            client,
            path: { space_id: resolvedSpaceId, id: datasourceEntryId },
            body,
            signal,
            ...buildCallOptions(client, throwOnError, fetchOptions),
          }),
        throwOnError,
      );
    },
    delete<ThrowOnError extends boolean = DefaultThrowOnError>(
      datasourceEntryId: number,
      options: {
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } & SpaceIdPathOverride = {},
    ): Promise<ApiResponse<void, ThrowOnError>> {
      const { signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<void, ThrowOnError>(
        () =>
          mapi.deleteDatasourceEntry({
            client,
            path: { space_id: resolvedSpaceId, id: datasourceEntryId },
            signal,
            ...buildCallOptions(client, throwOnError, fetchOptions),
          }),
        throwOnError,
      );
    },
  };

  type ListOptions<ThrowOnError extends boolean> = NonNullable<
    Parameters<typeof resource.list<ThrowOnError>>[0]
  >;

  const toPaginateConfig = <ThrowOnError extends boolean>(options: ListOptions<ThrowOnError>) => ({
    query: { ...options.query },
    signal: options.signal,
    fetchPage: (query: ListOptions<false>["query"], signal: AbortSignal) =>
      resource.list({ ...options, query, signal, throwOnError: false }),
    getItems: (data: DatasourceEntriesIndexResponse) => data.datasource_entries,
  });

  return {
    ...resource,

    /**
     * Walks every page of datasource entries, yielding one `list()` response per page. A failed page
     * is the last value yielded, so check `error` on each one. With `throwOnError`, it
     * throws a `PaginationError` instead.
     */
    pages: <ThrowOnError extends boolean = DefaultThrowOnError>(
      options: ListOptions<ThrowOnError> = {},
    ): AsyncGenerator<PageResult<DatasourceEntriesIndexResponse, ThrowOnError>, void, undefined> =>
      paginatePages(
        toPaginateConfig(options),
        options.throwOnError,
        client.getConfig().throwOnError ?? false,
      ),

    /**
     * Walks every datasource entry across all pages, fetching the next page while the current one
     * is consumed. A failed page throws a `PaginationError`.
     */
    iterate: (
      options: Omit<ListOptions<boolean>, "throwOnError"> = {},
    ): AsyncGenerator<
      DatasourceEntriesIndexResponse["datasource_entries"][number],
      void,
      undefined
    > => paginateItems(toPaginateConfig(options)),
  };
}
