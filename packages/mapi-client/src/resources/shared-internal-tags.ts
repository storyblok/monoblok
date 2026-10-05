import * as mapi from "../generated/mapi/sdk.gen";
import type {
  CreateSharedInternalTagData,
  CreateSharedInternalTagResponses,
  DeleteSharedInternalTagData,
  ListSharedInternalTagsData,
  ListSharedInternalTagsResponses,
  UpdateSharedInternalTagData,
  UpdateSharedInternalTagResponses,
} from "../generated/mapi/types.gen";
import type { ApiResponse, FetchOptions, MapiResourceDeps } from "../client";
import type { PageResult } from "../utils/paginate";
import { paginateItems, paginatePages } from "../utils/paginate";
import { resolveSpaceId, type SpaceIdPathOverride } from "./shared";

/**
 * Shared (organization-level) internal tags, scoped to a library. Every method
 * carries `asset_folder_id` = library root (query param on list/delete, body
 * field on create/update). Responses use the same `InternalTag` shape as
 * space-local internal tags.
 */
export function createSharedInternalTagsResource<DefaultThrowOnError extends boolean = false>(
  deps: MapiResourceDeps<DefaultThrowOnError>,
) {
  const { client, spaceId, wrapRequest } = deps;
  const getSpaceId = (path?: SpaceIdPathOverride["path"]) => resolveSpaceId(spaceId, path);
  const kyOpts = (fetchOptions?: FetchOptions) =>
    fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {};
  const maybeThrow = (throwOnError?: boolean) =>
    throwOnError === undefined ? {} : { throwOnError };

  const resource = {
    list<ThrowOnError extends boolean = false>(
      options: {
        query: ListSharedInternalTagsData["query"];
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } & SpaceIdPathOverride,
    ): Promise<ApiResponse<ListSharedInternalTagsResponses[200], ThrowOnError>> {
      const { query, signal, path, throwOnError, fetchOptions } = options;
      return wrapRequest<ListSharedInternalTagsResponses[200], ThrowOnError>(
        () =>
          mapi.listSharedInternalTags({
            client,
            path: { space_id: getSpaceId(path) },
            query,
            signal,
            ...maybeThrow(throwOnError),
            ...kyOpts(fetchOptions),
          }),
        throwOnError,
      );
    },
    create<ThrowOnError extends boolean = false>(
      options: {
        body: CreateSharedInternalTagData["body"];
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } & SpaceIdPathOverride,
    ): Promise<ApiResponse<CreateSharedInternalTagResponses[200], ThrowOnError>> {
      const { body, signal, path, throwOnError, fetchOptions } = options;
      return wrapRequest<CreateSharedInternalTagResponses[200], ThrowOnError>(
        () =>
          mapi.createSharedInternalTag({
            client,
            path: { space_id: getSpaceId(path) },
            body,
            signal,
            ...maybeThrow(throwOnError),
            ...kyOpts(fetchOptions),
          }),
        throwOnError,
      );
    },
    update<ThrowOnError extends boolean = false>(
      tagId: number,
      options: {
        body: UpdateSharedInternalTagData["body"];
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } & SpaceIdPathOverride,
    ): Promise<ApiResponse<UpdateSharedInternalTagResponses[200], ThrowOnError>> {
      const { body, signal, path, throwOnError, fetchOptions } = options;
      return wrapRequest<UpdateSharedInternalTagResponses[200], ThrowOnError>(
        () =>
          mapi.updateSharedInternalTag({
            client,
            path: { space_id: getSpaceId(path), id: tagId },
            body,
            signal,
            ...maybeThrow(throwOnError),
            ...kyOpts(fetchOptions),
          }),
        throwOnError,
      );
    },
    delete<ThrowOnError extends boolean = false>(
      tagId: number,
      options: {
        query: DeleteSharedInternalTagData["query"];
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } & SpaceIdPathOverride,
    ): Promise<ApiResponse<void, ThrowOnError>> {
      const { query, signal, path, throwOnError, fetchOptions } = options;
      return wrapRequest<void, ThrowOnError>(
        () =>
          mapi.deleteSharedInternalTag({
            client,
            path: { space_id: getSpaceId(path), id: tagId },
            query,
            signal,
            ...maybeThrow(throwOnError),
            ...kyOpts(fetchOptions),
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
    getItems: (data: ListSharedInternalTagsResponses[200]) => data.internal_tags,
  });

  return {
    ...resource,

    /**
     * Walks every page of shared internal tags, yielding one `list()` response per page. A failed
     * page is the last value yielded, so check `error` on each one. With `throwOnError`, it throws
     * a `PaginationError` instead.
     */
    pages: <ThrowOnError extends boolean = false>(
      options: ListOptions<ThrowOnError>,
    ): AsyncGenerator<
      PageResult<ListSharedInternalTagsResponses[200], ThrowOnError>,
      void,
      undefined
    > =>
      paginatePages(
        toPaginateConfig(options),
        options.throwOnError,
        client.getConfig().throwOnError ?? false,
      ),

    /**
     * Walks every shared internal tag across all pages, fetching the next page while the current
     * one is consumed. A failed page throws a `PaginationError`.
     */
    iterate: (
      options: Omit<ListOptions<boolean>, "throwOnError">,
    ): AsyncGenerator<
      ListSharedInternalTagsResponses[200]["internal_tags"][number],
      void,
      undefined
    > => paginateItems(toPaginateConfig(options)),
  };
}
