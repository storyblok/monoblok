import * as mapi from "../generated/mapi/sdk.gen";
import type {
  CreateWorkflowData,
  CreateWorkflowResponses,
  DeleteWorkflowResponses,
  GetWorkflowData,
  GetWorkflowResponses,
  ListWorkflowsData,
  ListWorkflowsResponses,
  UpdateWorkflowData,
  UpdateWorkflowResponses,
} from "../generated/mapi/types.gen";
import type { ApiResponse, FetchOptions, MapiResourceDeps } from "../client";
import { buildCallOptions, resolveSpaceId, type SpaceIdPathOverride } from "./shared";

export function createWorkflowsResource<DefaultThrowOnError extends boolean = false>(
  deps: MapiResourceDeps<DefaultThrowOnError>,
) {
  const { client, spaceId, wrapRequest } = deps;
  const getSpaceId = (path?: SpaceIdPathOverride["path"]) => resolveSpaceId(spaceId, path);

  return {
    list<ThrowOnError extends boolean = DefaultThrowOnError>(
      options: {
        query?: ListWorkflowsData["query"];
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } & SpaceIdPathOverride = {},
    ): Promise<ApiResponse<ListWorkflowsResponses[200], ThrowOnError>> {
      const { query, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<ListWorkflowsResponses[200], ThrowOnError>(
        () =>
          mapi.listWorkflows({
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
      workflowId: number,
      options: {
        query?: GetWorkflowData["query"];
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } & SpaceIdPathOverride = {},
    ): Promise<ApiResponse<GetWorkflowResponses[200], ThrowOnError>> {
      const { query, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<GetWorkflowResponses[200], ThrowOnError>(
        () =>
          mapi.getWorkflow({
            client,
            path: { space_id: resolvedSpaceId, id: workflowId },
            query,
            signal,
            ...buildCallOptions(client, throwOnError, fetchOptions),
          }),
        throwOnError,
      );
    },
    create<ThrowOnError extends boolean = DefaultThrowOnError>(
      options: {
        body: CreateWorkflowData["body"];
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } & SpaceIdPathOverride,
    ): Promise<ApiResponse<CreateWorkflowResponses[201], ThrowOnError>> {
      const { body, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<CreateWorkflowResponses[201], ThrowOnError>(
        () =>
          mapi.createWorkflow({
            client,
            path: { space_id: resolvedSpaceId },
            body,
            signal,
            ...buildCallOptions(client, throwOnError, fetchOptions),
          }),
        throwOnError,
      );
    },
    /** Updates a workflow (`PUT`; workflows have no `PATCH`). Only the fields in the body change. */
    update<ThrowOnError extends boolean = DefaultThrowOnError>(
      workflowId: number,
      options: {
        body: UpdateWorkflowData["body"];
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } & SpaceIdPathOverride,
    ): Promise<ApiResponse<UpdateWorkflowResponses[204], ThrowOnError>> {
      const { body, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<UpdateWorkflowResponses[204], ThrowOnError>(
        () =>
          mapi.updateWorkflow({
            client,
            path: { space_id: resolvedSpaceId, id: workflowId },
            body,
            signal,
            ...buildCallOptions(client, throwOnError, fetchOptions),
          }),
        throwOnError,
      );
    },
    delete<ThrowOnError extends boolean = DefaultThrowOnError>(
      workflowId: number,
      options: {
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } & SpaceIdPathOverride = {},
    ): Promise<ApiResponse<DeleteWorkflowResponses[204], ThrowOnError>> {
      const { signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<DeleteWorkflowResponses[204], ThrowOnError>(
        () =>
          mapi.deleteWorkflow({
            client,
            path: { space_id: resolvedSpaceId, id: workflowId },
            signal,
            ...buildCallOptions(client, throwOnError, fetchOptions),
          }),
        throwOnError,
      );
    },
  };
}
