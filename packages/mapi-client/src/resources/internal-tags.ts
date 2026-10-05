import * as mapi from "../generated/mapi/sdk.gen";
import type {
  CreateInternalTagData,
  CreateInternalTagResponses,
  ListInternalTagsData,
  ListInternalTagsResponses,
  UpdateInternalTagData,
  UpdateInternalTagResponses,
} from "../generated/mapi/types.gen";
import type { ApiResponse, FetchOptions, MapiResourceDeps } from "../client";
import type { PageResult } from "../utils/paginate";
import { paginateItems, paginatePages } from "../utils/paginate";
import { resolveSpaceId, type SpaceIdPathOverride } from "./shared";

export function createInternalTagsResource<DefaultThrowOnError extends boolean = false>(
  deps: MapiResourceDeps<DefaultThrowOnError>,
) {
  const { client, spaceId, wrapRequest } = deps;
  const getSpaceId = (path?: SpaceIdPathOverride["path"]) => resolveSpaceId(spaceId, path);

  const resource = {
    list<ThrowOnError extends boolean = DefaultThrowOnError>(
      options: {
        query?: ListInternalTagsData["query"];
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } & SpaceIdPathOverride = {},
    ): Promise<ApiResponse<ListInternalTagsResponses[200], ThrowOnError>> {
      const { query, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<ListInternalTagsResponses[200], ThrowOnError>(
        () =>
          mapi.listInternalTags({
            client,
            path: { space_id: resolvedSpaceId },
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
    create<ThrowOnError extends boolean = DefaultThrowOnError>(
      options: {
        body: CreateInternalTagData["body"];
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } & SpaceIdPathOverride,
    ): Promise<ApiResponse<CreateInternalTagResponses[200], ThrowOnError>> {
      const { body, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<CreateInternalTagResponses[200], ThrowOnError>(
        () =>
          mapi.createInternalTag({
            client,
            path: { space_id: resolvedSpaceId },
            body,
            signal,
            ...(throwOnError === undefined ? {} : { throwOnError }),
            ...(fetchOptions
              ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } }
              : {}),
          }),
        throwOnError,
      );
    },
    update<ThrowOnError extends boolean = DefaultThrowOnError>(
      internalTagId: number,
      options: {
        body: UpdateInternalTagData["body"];
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } & SpaceIdPathOverride,
    ): Promise<ApiResponse<UpdateInternalTagResponses[200], ThrowOnError>> {
      const { body, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<UpdateInternalTagResponses[200], ThrowOnError>(
        () =>
          mapi.updateInternalTag({
            client,
            path: { space_id: resolvedSpaceId, id: internalTagId },
            body,
            signal,
            ...(throwOnError === undefined ? {} : { throwOnError }),
            ...(fetchOptions
              ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } }
              : {}),
          }),
        throwOnError,
      );
    },
    delete<ThrowOnError extends boolean = DefaultThrowOnError>(
      internalTagId: number,
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
          mapi.deleteInternalTag({
            client,
            path: { space_id: resolvedSpaceId, id: internalTagId },
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

  type ListOptions<ThrowOnError extends boolean> = NonNullable<
    Parameters<typeof resource.list<ThrowOnError>>[0]
  >;

  const toPaginateConfig = <ThrowOnError extends boolean>(options: ListOptions<ThrowOnError>) => ({
    query: { ...options.query },
    signal: options.signal,
    fetchPage: (query: ListOptions<false>["query"], signal: AbortSignal) =>
      resource.list({ ...options, query, signal, throwOnError: false }),
    getItems: (data: ListInternalTagsResponses[200]) => data.internal_tags,
  });

  return {
    ...resource,

    /**
     * Walks every page of internal tags, yielding one `list()` response per page. A failed page
     * is the last value yielded, so check `error` on each one. With `throwOnError`, it
     * throws a `PaginationError` instead.
     */
    pages: <ThrowOnError extends boolean = DefaultThrowOnError>(
      options: ListOptions<ThrowOnError> = {},
    ): AsyncGenerator<PageResult<ListInternalTagsResponses[200], ThrowOnError>, void, undefined> =>
      paginatePages(
        toPaginateConfig(options),
        options.throwOnError,
        client.getConfig().throwOnError ?? false,
      ),

    /**
     * Walks every internal tag across all pages, fetching the next page while the current one
     * is consumed. A failed page throws a `PaginationError`.
     */
    iterate: (
      options: Omit<ListOptions<boolean>, "throwOnError"> = {},
    ): AsyncGenerator<ListInternalTagsResponses[200]["internal_tags"][number], void, undefined> =>
      paginateItems(toPaginateConfig(options)),
  };
}
