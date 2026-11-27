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
import { createPaginationMethods } from "../utils/paginate";
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

  type ListOptions = Omit<NonNullable<Parameters<typeof resource.list>[0]>, "throwOnError">;

  const paginationMethods = createPaginationMethods(deps, {
    fetchPage: (options: ListOptions | undefined, pageQuery, signal) =>
      resource.list({
        ...options,
        query: { ...options?.query, ...pageQuery },
        signal,
        throwOnError: false,
      }),
    getItems: (data) => data.internal_tags,
  });

  return { ...resource, ...paginationMethods };
}
