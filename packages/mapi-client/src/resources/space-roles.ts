import * as mapi from "../generated/mapi/sdk.gen";
import type {
  CreateSpaceRoleData,
  CreateSpaceRoleResponses,
  DeleteSpaceRoleResponses,
  GetSpaceRoleResponses,
  ListSpaceRolesData,
  ListSpaceRolesResponses,
  PartialUpdateSpaceRoleData,
  PartialUpdateSpaceRoleResponses,
  ReplaceSpaceRoleData,
  ReplaceSpaceRoleResponses,
} from "../generated/mapi/types.gen";
import type { ApiResponse, FetchOptions, MapiResourceDeps } from "../client";
import { buildCallOptions, resolveSpaceId, type SpaceIdPathOverride } from "./shared";

export function createSpaceRolesResource<DefaultThrowOnError extends boolean = false>(
  deps: MapiResourceDeps<DefaultThrowOnError>,
) {
  const { client, spaceId, wrapRequest } = deps;
  const getSpaceId = (path?: SpaceIdPathOverride["path"]) => resolveSpaceId(spaceId, path);

  return {
    list<ThrowOnError extends boolean = DefaultThrowOnError>(
      options: {
        query?: ListSpaceRolesData["query"];
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } & SpaceIdPathOverride = {},
    ): Promise<ApiResponse<ListSpaceRolesResponses[200], ThrowOnError>> {
      const { query, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<ListSpaceRolesResponses[200], ThrowOnError>(
        () =>
          mapi.listSpaceRoles({
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
      spaceRoleId: number,
      options: {
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } & SpaceIdPathOverride = {},
    ): Promise<ApiResponse<GetSpaceRoleResponses[200], ThrowOnError>> {
      const { signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<GetSpaceRoleResponses[200], ThrowOnError>(
        () =>
          mapi.getSpaceRole({
            client,
            path: { space_id: resolvedSpaceId, id: spaceRoleId },
            signal,
            ...buildCallOptions(client, throwOnError, fetchOptions),
          }),
        throwOnError,
      );
    },
    create<ThrowOnError extends boolean = DefaultThrowOnError>(
      options: {
        body: CreateSpaceRoleData["body"];
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } & SpaceIdPathOverride,
    ): Promise<ApiResponse<CreateSpaceRoleResponses[201], ThrowOnError>> {
      const { body, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<CreateSpaceRoleResponses[201], ThrowOnError>(
        () =>
          mapi.createSpaceRole({
            client,
            path: { space_id: resolvedSpaceId },
            body,
            signal,
            ...buildCallOptions(client, throwOnError, fetchOptions),
          }),
        throwOnError,
      );
    },
    /** Updates a space role (`PATCH`). Only the fields in the body change. */
    update<ThrowOnError extends boolean = DefaultThrowOnError>(
      spaceRoleId: number,
      options: {
        body: PartialUpdateSpaceRoleData["body"];
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } & SpaceIdPathOverride,
    ): Promise<ApiResponse<PartialUpdateSpaceRoleResponses[200], ThrowOnError>> {
      const { body, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<PartialUpdateSpaceRoleResponses[200], ThrowOnError>(
        () =>
          mapi.partialUpdateSpaceRole({
            client,
            path: { space_id: resolvedSpaceId, id: spaceRoleId },
            body,
            signal,
            ...buildCallOptions(client, throwOnError, fetchOptions),
          }),
        throwOnError,
      );
    },
    /** Updates a space role (`PUT`). Behaves like `update()`: only the fields in the body change. */
    replace<ThrowOnError extends boolean = DefaultThrowOnError>(
      spaceRoleId: number,
      options: {
        body: ReplaceSpaceRoleData["body"];
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } & SpaceIdPathOverride,
    ): Promise<ApiResponse<ReplaceSpaceRoleResponses[200], ThrowOnError>> {
      const { body, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<ReplaceSpaceRoleResponses[200], ThrowOnError>(
        () =>
          mapi.replaceSpaceRole({
            client,
            path: { space_id: resolvedSpaceId, id: spaceRoleId },
            body,
            signal,
            ...buildCallOptions(client, throwOnError, fetchOptions),
          }),
        throwOnError,
      );
    },
    delete<ThrowOnError extends boolean = DefaultThrowOnError>(
      spaceRoleId: number,
      options: {
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } & SpaceIdPathOverride = {},
    ): Promise<ApiResponse<DeleteSpaceRoleResponses[200], ThrowOnError>> {
      const { signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<DeleteSpaceRoleResponses[200], ThrowOnError>(
        () =>
          mapi.deleteSpaceRole({
            client,
            path: { space_id: resolvedSpaceId, id: spaceRoleId },
            signal,
            ...buildCallOptions(client, throwOnError, fetchOptions),
          }),
        throwOnError,
      );
    },
  };
}
