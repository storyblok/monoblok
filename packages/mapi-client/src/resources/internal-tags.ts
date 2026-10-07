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
import { resolveSpaceId, type SpaceIdPathOverride } from "./shared";
import { buildCallOptions } from "@storyblok/utils/http";

export function createInternalTagsResource<DefaultThrowOnError extends boolean = false>(
  deps: MapiResourceDeps<DefaultThrowOnError>,
) {
  const { client, spaceId, wrapRequest } = deps;
  const getSpaceId = (path?: SpaceIdPathOverride["path"]) => resolveSpaceId(spaceId, path);

  return {
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
            ...buildCallOptions(client, throwOnError, fetchOptions),
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
            ...buildCallOptions(client, throwOnError, fetchOptions),
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
            ...buildCallOptions(client, throwOnError, fetchOptions),
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
            ...buildCallOptions(client, throwOnError, fetchOptions),
          }),
        throwOnError,
      );
    },
  };
}
