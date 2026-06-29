import * as experimentsApi from '../generated/experiments/sdk.gen';
import type {
  ActivateData,
  ActivateResponses,
  CompleteResponses,
  CompleteWithWinnerResponses,
  CreateData,
  CreateExperimentStoryData,
  CreateExperimentStoryResponses,
  CreateResponses,
  CreateStoryMappingData,
  CreateStoryMappingResponses,
  DeleteExperimentStoryResponses,
  DeleteResponses,
  DeleteStoryMappingResponses,
  GetResponses,
  GetResultsResponses,
  ListData,
  ListResponses,
  PauseResponses,
  PushResultsData,
  PushResultsResponses,
  SelectWinnerResponses,
  UpdateData,
  UpdateResponses,
} from '../generated/experiments/types.gen';
import type { ApiResponse, FetchOptions, MapiResourceDeps } from '../index';
import { resolveSpaceId, type SpaceIdPathOverride } from './shared';

export function createExperimentsResource(deps: MapiResourceDeps) {
  const { client, spaceId, wrapRequest } = deps;
  const getSpaceId = (path?: SpaceIdPathOverride['path']) => resolveSpaceId(spaceId, path);

  return {
    list<ThrowOnError extends boolean = false>(options: { query?: ListData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {}): Promise<ApiResponse<ListResponses[200], ThrowOnError>> {
      const { query, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<ListResponses[200], ThrowOnError>(() =>
        experimentsApi.list({ client, path: { space_id: resolvedSpaceId }, query, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    get<ThrowOnError extends boolean = false>(experimentId: number | string, options: { signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {}): Promise<ApiResponse<GetResponses[200], ThrowOnError>> {
      const { signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<GetResponses[200], ThrowOnError>(() =>
        experimentsApi.get({ client, path: { space_id: resolvedSpaceId, experiment_id: experimentId }, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    create<ThrowOnError extends boolean = false>(options: { body: CreateData['body']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride): Promise<ApiResponse<CreateResponses[201], ThrowOnError>> {
      const { body, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<CreateResponses[201], ThrowOnError>(() =>
        experimentsApi.create({ client, path: { space_id: resolvedSpaceId }, body, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    update<ThrowOnError extends boolean = false>(
      experimentId: number | string,
      options: { body: UpdateData['body']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride,
    ): Promise<ApiResponse<UpdateResponses[200], ThrowOnError>> {
      const { body, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<UpdateResponses[200], ThrowOnError>(() =>
        experimentsApi.update({ client, path: { space_id: resolvedSpaceId, experiment_id: experimentId }, body, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    delete<ThrowOnError extends boolean = false>(experimentId: number | string, options: { signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {}): Promise<ApiResponse<DeleteResponses[204], ThrowOnError>> {
      const { signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<DeleteResponses[204], ThrowOnError>(() =>
        experimentsApi.delete_({ client, path: { space_id: resolvedSpaceId, experiment_id: experimentId }, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    activate<ThrowOnError extends boolean = false>(
      experimentId: number | string,
      options: { query?: ActivateData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {},
    ): Promise<ApiResponse<ActivateResponses[200], ThrowOnError>> {
      const { query, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<ActivateResponses[200], ThrowOnError>(() =>
        experimentsApi.activate({ client, path: { space_id: resolvedSpaceId, experiment_id: experimentId }, query, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    pause<ThrowOnError extends boolean = false>(experimentId: number | string, options: { signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {}): Promise<ApiResponse<PauseResponses[200], ThrowOnError>> {
      const { signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<PauseResponses[200], ThrowOnError>(() =>
        experimentsApi.pause({ client, path: { space_id: resolvedSpaceId, experiment_id: experimentId }, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    complete<ThrowOnError extends boolean = false>(experimentId: number | string, options: { signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {}): Promise<ApiResponse<CompleteResponses[200], ThrowOnError>> {
      const { signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<CompleteResponses[200], ThrowOnError>(() =>
        experimentsApi.complete({ client, path: { space_id: resolvedSpaceId, experiment_id: experimentId }, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    completeWithWinner<ThrowOnError extends boolean = false>(
      experimentId: number | string,
      variantId: number,
      options: { signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {},
    ): Promise<ApiResponse<CompleteWithWinnerResponses[200], ThrowOnError>> {
      const { signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<CompleteWithWinnerResponses[200], ThrowOnError>(() =>
        experimentsApi.completeWithWinner({ client, path: { space_id: resolvedSpaceId, experiment_id: experimentId }, query: { variant_id: variantId }, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    selectWinner<ThrowOnError extends boolean = false>(
      experimentId: number | string,
      variantId: number,
      options: { signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {},
    ): Promise<ApiResponse<SelectWinnerResponses[200], ThrowOnError>> {
      const { signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<SelectWinnerResponses[200], ThrowOnError>(() =>
        experimentsApi.selectWinner({ client, path: { space_id: resolvedSpaceId, experiment_id: experimentId }, query: { variant_id: variantId }, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    stories: {
      create<ThrowOnError extends boolean = false>(
        experimentId: number | string,
        options: { body: CreateExperimentStoryData['body']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride,
      ): Promise<ApiResponse<CreateExperimentStoryResponses[201], ThrowOnError>> {
        const { body, signal, path, throwOnError, fetchOptions } = options;
        const resolvedSpaceId = getSpaceId(path);
        return wrapRequest<CreateExperimentStoryResponses[201], ThrowOnError>(() =>
          experimentsApi.createExperimentStory({ client, path: { space_id: resolvedSpaceId, experiment_id: experimentId }, body, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
      },
      delete<ThrowOnError extends boolean = false>(
        experimentId: number | string,
        storyId: number | string,
        options: { signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {},
      ): Promise<ApiResponse<DeleteExperimentStoryResponses[204], ThrowOnError>> {
        const { signal, path, throwOnError, fetchOptions } = options;
        const resolvedSpaceId = getSpaceId(path);
        return wrapRequest<DeleteExperimentStoryResponses[204], ThrowOnError>(() =>
          experimentsApi.deleteExperimentStory({ client, path: { space_id: resolvedSpaceId, experiment_id: experimentId, story_id: storyId }, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
      },
    },
    storyMappings: {
      create<ThrowOnError extends boolean = false>(
        experimentId: number | string,
        variantId: number | string,
        options: { body: CreateStoryMappingData['body']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride,
      ): Promise<ApiResponse<CreateStoryMappingResponses[201], ThrowOnError>> {
        const { body, signal, path, throwOnError, fetchOptions } = options;
        const resolvedSpaceId = getSpaceId(path);
        return wrapRequest<CreateStoryMappingResponses[201], ThrowOnError>(() =>
          experimentsApi.createStoryMapping({ client, path: { space_id: resolvedSpaceId, experiment_id: experimentId, variant_id: variantId }, body, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
      },
      delete<ThrowOnError extends boolean = false>(
        experimentId: number | string,
        variantId: number | string,
        originalStoryId: number | string,
        options: { signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {},
      ): Promise<ApiResponse<DeleteStoryMappingResponses[204], ThrowOnError>> {
        const { signal, path, throwOnError, fetchOptions } = options;
        const resolvedSpaceId = getSpaceId(path);
        return wrapRequest<DeleteStoryMappingResponses[204], ThrowOnError>(() =>
          experimentsApi.deleteStoryMapping({ client, path: { space_id: resolvedSpaceId, experiment_id: experimentId, variant_id: variantId, original_story_id: originalStoryId }, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
      },
    },
    results: {
      get<ThrowOnError extends boolean = false>(experimentId: number | string, options: { signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {}): Promise<ApiResponse<GetResultsResponses[200], ThrowOnError>> {
        const { signal, path, throwOnError, fetchOptions } = options;
        const resolvedSpaceId = getSpaceId(path);
        return wrapRequest<GetResultsResponses[200], ThrowOnError>(() =>
          experimentsApi.getResults({ client, path: { space_id: resolvedSpaceId, experiment_id: experimentId }, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
      },
      push<ThrowOnError extends boolean = false>(
        experimentId: number | string,
        options: { body: PushResultsData['body']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride,
      ): Promise<ApiResponse<PushResultsResponses[200], ThrowOnError>> {
        const { body, signal, path, throwOnError, fetchOptions } = options;
        const resolvedSpaceId = getSpaceId(path);
        return wrapRequest<PushResultsResponses[200], ThrowOnError>(() =>
          experimentsApi.pushResults({ client, path: { space_id: resolvedSpaceId, experiment_id: experimentId }, body, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
      },
    },
  };
}
