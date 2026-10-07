import * as experimentsApi from "../generated/mapi/sdk.gen";
import type {
  ActivateExperimentData,
  ActivateExperimentResponses,
  CompleteExperimentResponses,
  CompleteExperimentWithWinnerResponses,
  CreateExperimentData,
  CreateExperimentResponses,
  CreateExperimentStoryData,
  CreateExperimentStoryResponses,
  CreateStoryMappingData,
  CreateStoryMappingResponses,
  DeleteExperimentResponses,
  DeleteExperimentStoryResponses,
  DeleteStoryMappingResponses,
  GetExperimentResponses,
  GetExperimentResultsResponses,
  ListExperimentsData,
  ListExperimentsResponses,
  PauseExperimentResponses,
  PushExperimentResultsData,
  PushExperimentResultsResponses,
  SelectExperimentWinnerResponses,
  UpdateExperimentData,
  UpdateExperimentResponses,
} from "../generated/mapi/types.gen";
import type { ApiResponse, FetchOptions, MapiResourceDeps } from "../client";
import { resolveSpaceId, type SpaceIdPathOverride } from "./shared";
import { buildCallOptions } from "@storyblok/utils/http";

export function createExperimentsResource(deps: MapiResourceDeps) {
  const { client, spaceId, wrapRequest } = deps;
  const getSpaceId = (path?: SpaceIdPathOverride["path"]) => resolveSpaceId(spaceId, path);

  return {
    list<ThrowOnError extends boolean = false>(
      options: {
        query?: ListExperimentsData["query"];
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } & SpaceIdPathOverride = {},
    ): Promise<ApiResponse<ListExperimentsResponses[200], ThrowOnError>> {
      const { query, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<ListExperimentsResponses[200], ThrowOnError>(
        () =>
          experimentsApi.listExperiments({
            client,
            path: { space_id: resolvedSpaceId },
            query,
            signal,
            ...buildCallOptions(client, throwOnError, fetchOptions),
          }),
        throwOnError,
      );
    },
    get<ThrowOnError extends boolean = false>(
      experimentId: number | string,
      options: {
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } & SpaceIdPathOverride = {},
    ): Promise<ApiResponse<GetExperimentResponses[200], ThrowOnError>> {
      const { signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<GetExperimentResponses[200], ThrowOnError>(
        () =>
          experimentsApi.getExperiment({
            client,
            path: { space_id: resolvedSpaceId, id: Number(experimentId) },
            signal,
            ...buildCallOptions(client, throwOnError, fetchOptions),
          }),
        throwOnError,
      );
    },
    create<ThrowOnError extends boolean = false>(
      options: {
        body: CreateExperimentData["body"];
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } & SpaceIdPathOverride,
    ): Promise<ApiResponse<CreateExperimentResponses[201], ThrowOnError>> {
      const { body, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<CreateExperimentResponses[201], ThrowOnError>(
        () =>
          experimentsApi.createExperiment({
            client,
            path: { space_id: resolvedSpaceId },
            body,
            signal,
            ...buildCallOptions(client, throwOnError, fetchOptions),
          }),
        throwOnError,
      );
    },
    update<ThrowOnError extends boolean = false>(
      experimentId: number | string,
      options: {
        body: UpdateExperimentData["body"];
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } & SpaceIdPathOverride,
    ): Promise<ApiResponse<UpdateExperimentResponses[200], ThrowOnError>> {
      const { body, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<UpdateExperimentResponses[200], ThrowOnError>(
        () =>
          experimentsApi.updateExperiment({
            client,
            path: { space_id: resolvedSpaceId, id: Number(experimentId) },
            body,
            signal,
            ...buildCallOptions(client, throwOnError, fetchOptions),
          }),
        throwOnError,
      );
    },
    delete<ThrowOnError extends boolean = false>(
      experimentId: number | string,
      options: {
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } & SpaceIdPathOverride = {},
    ): Promise<ApiResponse<DeleteExperimentResponses[204], ThrowOnError>> {
      const { signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<DeleteExperimentResponses[204], ThrowOnError>(
        () =>
          experimentsApi.deleteExperiment({
            client,
            path: { space_id: resolvedSpaceId, id: Number(experimentId) },
            signal,
            ...buildCallOptions(client, throwOnError, fetchOptions),
          }),
        throwOnError,
      );
    },
    activate<ThrowOnError extends boolean = false>(
      experimentId: number | string,
      options: {
        query?: ActivateExperimentData["query"];
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } & SpaceIdPathOverride = {},
    ): Promise<ApiResponse<ActivateExperimentResponses[200], ThrowOnError>> {
      const { query, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<ActivateExperimentResponses[200], ThrowOnError>(
        () =>
          experimentsApi.activateExperiment({
            client,
            path: { space_id: resolvedSpaceId, id: Number(experimentId) },
            query,
            signal,
            ...buildCallOptions(client, throwOnError, fetchOptions),
          }),
        throwOnError,
      );
    },
    pause<ThrowOnError extends boolean = false>(
      experimentId: number | string,
      options: {
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } & SpaceIdPathOverride = {},
    ): Promise<ApiResponse<PauseExperimentResponses[200], ThrowOnError>> {
      const { signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<PauseExperimentResponses[200], ThrowOnError>(
        () =>
          experimentsApi.pauseExperiment({
            client,
            path: { space_id: resolvedSpaceId, id: Number(experimentId) },
            signal,
            ...buildCallOptions(client, throwOnError, fetchOptions),
          }),
        throwOnError,
      );
    },
    complete<ThrowOnError extends boolean = false>(
      experimentId: number | string,
      options: {
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } & SpaceIdPathOverride = {},
    ): Promise<ApiResponse<CompleteExperimentResponses[200], ThrowOnError>> {
      const { signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<CompleteExperimentResponses[200], ThrowOnError>(
        () =>
          experimentsApi.completeExperiment({
            client,
            path: { space_id: resolvedSpaceId, id: Number(experimentId) },
            signal,
            ...buildCallOptions(client, throwOnError, fetchOptions),
          }),
        throwOnError,
      );
    },
    completeWithWinner<ThrowOnError extends boolean = false>(
      experimentId: number | string,
      variantId: number,
      options: {
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } & SpaceIdPathOverride = {},
    ): Promise<ApiResponse<CompleteExperimentWithWinnerResponses[200], ThrowOnError>> {
      const { signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<CompleteExperimentWithWinnerResponses[200], ThrowOnError>(
        () =>
          experimentsApi.completeExperimentWithWinner({
            client,
            path: { space_id: resolvedSpaceId, id: Number(experimentId) },
            query: { variant_id: variantId },
            signal,
            ...buildCallOptions(client, throwOnError, fetchOptions),
          }),
        throwOnError,
      );
    },
    selectWinner<ThrowOnError extends boolean = false>(
      experimentId: number | string,
      variantId: number,
      options: {
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } & SpaceIdPathOverride = {},
    ): Promise<ApiResponse<SelectExperimentWinnerResponses[200], ThrowOnError>> {
      const { signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<SelectExperimentWinnerResponses[200], ThrowOnError>(
        () =>
          experimentsApi.selectExperimentWinner({
            client,
            path: { space_id: resolvedSpaceId, id: Number(experimentId) },
            query: { variant_id: variantId },
            signal,
            ...buildCallOptions(client, throwOnError, fetchOptions),
          }),
        throwOnError,
      );
    },
    stories: {
      create<ThrowOnError extends boolean = false>(
        experimentId: number | string,
        options: {
          body: CreateExperimentStoryData["body"];
          signal?: AbortSignal;
          throwOnError?: ThrowOnError;
          fetchOptions?: FetchOptions;
        } & SpaceIdPathOverride,
      ): Promise<ApiResponse<CreateExperimentStoryResponses[201], ThrowOnError>> {
        const { body, signal, path, throwOnError, fetchOptions } = options;
        const resolvedSpaceId = getSpaceId(path);
        return wrapRequest<CreateExperimentStoryResponses[201], ThrowOnError>(
          () =>
            experimentsApi.createExperimentStory({
              client,
              path: { space_id: resolvedSpaceId, experiment_id: Number(experimentId) },
              body,
              signal,
              ...buildCallOptions(client, throwOnError, fetchOptions),
            }),
          throwOnError,
        );
      },
      delete<ThrowOnError extends boolean = false>(
        experimentId: number | string,
        storyId: number | string,
        options: {
          signal?: AbortSignal;
          throwOnError?: ThrowOnError;
          fetchOptions?: FetchOptions;
        } & SpaceIdPathOverride = {},
      ): Promise<ApiResponse<DeleteExperimentStoryResponses[204], ThrowOnError>> {
        const { signal, path, throwOnError, fetchOptions } = options;
        const resolvedSpaceId = getSpaceId(path);
        return wrapRequest<DeleteExperimentStoryResponses[204], ThrowOnError>(
          () =>
            experimentsApi.deleteExperimentStory({
              client,
              path: {
                space_id: resolvedSpaceId,
                experiment_id: Number(experimentId),
                story_id: Number(storyId),
              },
              signal,
              ...buildCallOptions(client, throwOnError, fetchOptions),
            }),
          throwOnError,
        );
      },
    },
    storyMappings: {
      create<ThrowOnError extends boolean = false>(
        experimentId: number | string,
        variantId: number | string,
        options: {
          body: CreateStoryMappingData["body"];
          signal?: AbortSignal;
          throwOnError?: ThrowOnError;
          fetchOptions?: FetchOptions;
        } & SpaceIdPathOverride,
      ): Promise<ApiResponse<CreateStoryMappingResponses[201], ThrowOnError>> {
        const { body, signal, path, throwOnError, fetchOptions } = options;
        const resolvedSpaceId = getSpaceId(path);
        return wrapRequest<CreateStoryMappingResponses[201], ThrowOnError>(
          () =>
            experimentsApi.createStoryMapping({
              client,
              path: {
                space_id: resolvedSpaceId,
                experiment_id: Number(experimentId),
                variant_id: Number(variantId),
              },
              body,
              signal,
              ...buildCallOptions(client, throwOnError, fetchOptions),
            }),
          throwOnError,
        );
      },
      delete<ThrowOnError extends boolean = false>(
        experimentId: number | string,
        variantId: number | string,
        originalStoryId: number | string,
        options: {
          signal?: AbortSignal;
          throwOnError?: ThrowOnError;
          fetchOptions?: FetchOptions;
        } & SpaceIdPathOverride = {},
      ): Promise<ApiResponse<DeleteStoryMappingResponses[204], ThrowOnError>> {
        const { signal, path, throwOnError, fetchOptions } = options;
        const resolvedSpaceId = getSpaceId(path);
        return wrapRequest<DeleteStoryMappingResponses[204], ThrowOnError>(
          () =>
            experimentsApi.deleteStoryMapping({
              client,
              path: {
                space_id: resolvedSpaceId,
                experiment_id: Number(experimentId),
                variant_id: Number(variantId),
                original_story_id: Number(originalStoryId),
              },
              signal,
              ...buildCallOptions(client, throwOnError, fetchOptions),
            }),
          throwOnError,
        );
      },
    },
    results: {
      get<ThrowOnError extends boolean = false>(
        experimentId: number | string,
        options: {
          signal?: AbortSignal;
          throwOnError?: ThrowOnError;
          fetchOptions?: FetchOptions;
        } & SpaceIdPathOverride = {},
      ): Promise<ApiResponse<GetExperimentResultsResponses[200], ThrowOnError>> {
        const { signal, path, throwOnError, fetchOptions } = options;
        const resolvedSpaceId = getSpaceId(path);
        return wrapRequest<GetExperimentResultsResponses[200], ThrowOnError>(
          () =>
            experimentsApi.getExperimentResults({
              client,
              path: { space_id: resolvedSpaceId, experiment_id: Number(experimentId) },
              signal,
              ...buildCallOptions(client, throwOnError, fetchOptions),
            }),
          throwOnError,
        );
      },
      push<ThrowOnError extends boolean = false>(
        experimentId: number | string,
        options: {
          body: PushExperimentResultsData["body"];
          signal?: AbortSignal;
          throwOnError?: ThrowOnError;
          fetchOptions?: FetchOptions;
        } & SpaceIdPathOverride,
      ): Promise<ApiResponse<PushExperimentResultsResponses[200], ThrowOnError>> {
        const { body, signal, path, throwOnError, fetchOptions } = options;
        const resolvedSpaceId = getSpaceId(path);
        return wrapRequest<PushExperimentResultsResponses[200], ThrowOnError>(
          () =>
            experimentsApi.pushExperimentResults({
              client,
              path: { space_id: resolvedSpaceId, experiment_id: Number(experimentId) },
              body,
              signal,
              ...buildCallOptions(client, throwOnError, fetchOptions),
            }),
          throwOnError,
        );
      },
    },
  };
}
