import * as mapi from "../generated/mapi/sdk.gen";
import type {
  GetOrganizationData,
  GetOrganizationResponses,
  PartialUpdateOrganizationData,
  PartialUpdateOrganizationResponses,
  UpdateOrganizationData,
  UpdateOrganizationResponses,
} from "../generated/mapi/types.gen";
import type { ApiResponse, FetchOptions, MapiResourceDeps } from "../client";
import { buildCallOptions } from "./shared";

/** The organization of the authenticated user. */
export function createOrgsResource<DefaultThrowOnError extends boolean = false>(
  deps: Omit<MapiResourceDeps<DefaultThrowOnError>, "spaceId">,
) {
  const { client, wrapRequest } = deps;

  return {
    /** Members of the organization receive the reduced `MemberOrganization` shape. */
    get<ThrowOnError extends boolean = DefaultThrowOnError>(
      options: {
        query?: GetOrganizationData["query"];
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } = {},
    ): Promise<ApiResponse<GetOrganizationResponses[200], ThrowOnError>> {
      const { query, signal, throwOnError, fetchOptions } = options;
      return wrapRequest<GetOrganizationResponses[200], ThrowOnError>(
        () =>
          mapi.getOrganization({
            client,
            query,
            signal,
            ...buildCallOptions(client, throwOnError, fetchOptions),
          }),
        throwOnError,
      );
    },
    /** Updates the organization (`PATCH`). Only the fields in the body change. */
    update<ThrowOnError extends boolean = DefaultThrowOnError>(options: {
      body: PartialUpdateOrganizationData["body"];
      signal?: AbortSignal;
      throwOnError?: ThrowOnError;
      fetchOptions?: FetchOptions;
    }): Promise<ApiResponse<PartialUpdateOrganizationResponses[204], ThrowOnError>> {
      const { body, signal, throwOnError, fetchOptions } = options;
      return wrapRequest<PartialUpdateOrganizationResponses[204], ThrowOnError>(
        () =>
          mapi.partialUpdateOrganization({
            client,
            body,
            signal,
            ...buildCallOptions(client, throwOnError, fetchOptions),
          }),
        throwOnError,
      );
    },
    /** Updates the organization (`PUT`). Behaves like `update()`: only the fields in the body change. */
    replace<ThrowOnError extends boolean = DefaultThrowOnError>(options: {
      body: UpdateOrganizationData["body"];
      signal?: AbortSignal;
      throwOnError?: ThrowOnError;
      fetchOptions?: FetchOptions;
    }): Promise<ApiResponse<UpdateOrganizationResponses[204], ThrowOnError>> {
      const { body, signal, throwOnError, fetchOptions } = options;
      return wrapRequest<UpdateOrganizationResponses[204], ThrowOnError>(
        () =>
          mapi.updateOrganization({
            client,
            body,
            signal,
            ...buildCallOptions(client, throwOnError, fetchOptions),
          }),
        throwOnError,
      );
    },
  };
}
