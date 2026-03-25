import * as storiesApi from '../generated/stories/sdk.gen';
import type {
  CreateData,
  CreateResponses,
  DuplicateData,
  DuplicateResponses,
  GetData,
  GetResponses,
  ListData,
  ListResponses,
  PublishData,
  PublishResponses,
  RemoveResponses,
  UpdateData,
  UpdateResponses,
  VersionsData,
  VersionsResponses,
} from '../generated/stories/types.gen';
import type { ApiResponse, FetchOptions, MapiResourceDeps } from '../index';
import { resolveSpaceId, type SpaceIdPathOverride } from './shared';

export function createStoriesResource(deps: MapiResourceDeps) {
  const { client, spaceId, wrapRequest } = deps;
  const getSpaceId = (path?: SpaceIdPathOverride['path']) => resolveSpaceId(spaceId, path);

  return {
    list<ThrowOnError extends boolean = false>(options: { query?: ListData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {}): Promise<ApiResponse<ListResponses[200], ThrowOnError>> {
      const { query, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<ListResponses[200], ThrowOnError>(() =>
        storiesApi.list({ client, path: { space_id: resolvedSpaceId }, query, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    get<ThrowOnError extends boolean = false>(storyId: number | string, options: { query?: GetData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {}): Promise<ApiResponse<GetResponses[200], ThrowOnError>> {
      const { query, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<GetResponses[200], ThrowOnError>(() =>
        storiesApi.get({ client, path: { space_id: resolvedSpaceId, story_id: storyId }, query, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    create<ThrowOnError extends boolean = false>(options: { body: CreateData['body']; query?: CreateData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride): Promise<ApiResponse<CreateResponses[201], ThrowOnError>> {
      const { body, query, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<CreateResponses[201], ThrowOnError>(() =>
        storiesApi.create({ client, path: { space_id: resolvedSpaceId }, body, query, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    update<ThrowOnError extends boolean = false>(
      storyId: number | string,
      options: { body: UpdateData['body']; query?: UpdateData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride,
    ): Promise<ApiResponse<UpdateResponses[200], ThrowOnError>> {
      const { body, query, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<UpdateResponses[200], ThrowOnError>(() =>
        storiesApi.update({ client, path: { space_id: resolvedSpaceId, story_id: storyId }, body, query, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    remove<ThrowOnError extends boolean = false>(storyId: number | string, options: { signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {}): Promise<ApiResponse<RemoveResponses[200], ThrowOnError>> {
      const { signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<RemoveResponses[200], ThrowOnError>(() =>
        storiesApi.remove({ client, path: { space_id: resolvedSpaceId, story_id: storyId }, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    duplicate<ThrowOnError extends boolean = false>(
      storyId: number | string,
      options: { body: DuplicateData['body']; query?: DuplicateData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride,
    ): Promise<ApiResponse<DuplicateResponses[200], ThrowOnError>> {
      const { body, query, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<DuplicateResponses[200], ThrowOnError>(() =>
        storiesApi.duplicate({ client, path: { space_id: resolvedSpaceId, story_id: storyId }, body, query, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    publish<ThrowOnError extends boolean = false>(
      storyId: number | string,
      options: { query?: PublishData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {},
    ): Promise<ApiResponse<PublishResponses[200], ThrowOnError>> {
      const { query, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<PublishResponses[200], ThrowOnError>(() =>
        storiesApi.publish({ client, path: { space_id: resolvedSpaceId, story_id: storyId }, query, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    versions<ThrowOnError extends boolean = false>(
      options: { query?: VersionsData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {},
    ): Promise<ApiResponse<VersionsResponses[200], ThrowOnError>> {
      const { query, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<VersionsResponses[200], ThrowOnError>(() =>
        storiesApi.versions({ client, path: { space_id: resolvedSpaceId }, query, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
  };
}
