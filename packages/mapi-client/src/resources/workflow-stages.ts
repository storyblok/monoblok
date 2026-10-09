import * as mapi from "../generated/mapi/sdk.gen";
import type {
  CreateWorkflowStageData,
  CreateWorkflowStageResponses,
  DeleteWorkflowStageResponses,
  GetWorkflowStageResponses,
  ListWorkflowStagesData,
  ListWorkflowStagesResponses,
  PartialUpdateWorkflowStageData,
  PartialUpdateWorkflowStageResponses,
  ReplaceWorkflowStageData,
  ReplaceWorkflowStageResponses,
} from "../generated/mapi/types.gen";
import type { ApiResponse, FetchOptions, MapiResourceDeps } from "../client";
import { buildCallOptions, resolveSpaceId, type SpaceIdPathOverride } from "./shared";

export function createWorkflowStagesResource<DefaultThrowOnError extends boolean = false>(
  deps: MapiResourceDeps<DefaultThrowOnError>,
) {
  const { client, spaceId, wrapRequest } = deps;
  const getSpaceId = (path?: SpaceIdPathOverride["path"]) => resolveSpaceId(spaceId, path);

  return {
    list<ThrowOnError extends boolean = DefaultThrowOnError>(
      options: {
        query?: ListWorkflowStagesData["query"];
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } & SpaceIdPathOverride = {},
    ): Promise<ApiResponse<ListWorkflowStagesResponses[200], ThrowOnError>> {
      const { query, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<ListWorkflowStagesResponses[200], ThrowOnError>(
        () =>
          mapi.listWorkflowStages({
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
      workflowStageId: number,
      options: {
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } & SpaceIdPathOverride = {},
    ): Promise<ApiResponse<GetWorkflowStageResponses[200], ThrowOnError>> {
      const { signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<GetWorkflowStageResponses[200], ThrowOnError>(
        () =>
          mapi.getWorkflowStage({
            client,
            path: { space_id: resolvedSpaceId, id: workflowStageId },
            signal,
            ...buildCallOptions(client, throwOnError, fetchOptions),
          }),
        throwOnError,
      );
    },
    create<ThrowOnError extends boolean = DefaultThrowOnError>(
      options: {
        body: CreateWorkflowStageData["body"];
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } & SpaceIdPathOverride,
    ): Promise<ApiResponse<CreateWorkflowStageResponses[201], ThrowOnError>> {
      const { body, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<CreateWorkflowStageResponses[201], ThrowOnError>(
        () =>
          mapi.createWorkflowStage({
            client,
            path: { space_id: resolvedSpaceId },
            body,
            signal,
            ...buildCallOptions(client, throwOnError, fetchOptions),
          }),
        throwOnError,
      );
    },
    /** Updates a workflow stage (`PATCH`). Only the fields in the body change. */
    update<ThrowOnError extends boolean = DefaultThrowOnError>(
      workflowStageId: number,
      options: {
        body: PartialUpdateWorkflowStageData["body"];
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } & SpaceIdPathOverride,
    ): Promise<ApiResponse<PartialUpdateWorkflowStageResponses[204], ThrowOnError>> {
      const { body, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<PartialUpdateWorkflowStageResponses[204], ThrowOnError>(
        () =>
          mapi.partialUpdateWorkflowStage({
            client,
            path: { space_id: resolvedSpaceId, id: workflowStageId },
            body,
            signal,
            ...buildCallOptions(client, throwOnError, fetchOptions),
          }),
        throwOnError,
      );
    },
    /** Updates a workflow stage (`PUT`). Behaves like `update()`: only the fields in the body change. */
    replace<ThrowOnError extends boolean = DefaultThrowOnError>(
      workflowStageId: number,
      options: {
        body: ReplaceWorkflowStageData["body"];
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } & SpaceIdPathOverride,
    ): Promise<ApiResponse<ReplaceWorkflowStageResponses[204], ThrowOnError>> {
      const { body, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<ReplaceWorkflowStageResponses[204], ThrowOnError>(
        () =>
          mapi.replaceWorkflowStage({
            client,
            path: { space_id: resolvedSpaceId, id: workflowStageId },
            body,
            signal,
            ...buildCallOptions(client, throwOnError, fetchOptions),
          }),
        throwOnError,
      );
    },
    delete<ThrowOnError extends boolean = DefaultThrowOnError>(
      workflowStageId: number,
      options: {
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } & SpaceIdPathOverride = {},
    ): Promise<ApiResponse<DeleteWorkflowStageResponses[204], ThrowOnError>> {
      const { signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<DeleteWorkflowStageResponses[204], ThrowOnError>(
        () =>
          mapi.deleteWorkflowStage({
            client,
            path: { space_id: resolvedSpaceId, id: workflowStageId },
            signal,
            ...buildCallOptions(client, throwOnError, fetchOptions),
          }),
        throwOnError,
      );
    },
  };
}
