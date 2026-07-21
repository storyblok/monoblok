import * as mapi from '../generated/mapi/sdk.gen';
import type {
  CreateStoryData,
  CreateStoryResponses,
  DeleteStoryResponses,
  DuplicateStoryData,
  DuplicateStoryResponses,
  GetStoryByIdData,
  GetStoryByIdResponses,
  ListStoriesData,
  ListStoriesResponses,
  ListVersionsData,
  ListVersionsResponses,
  PublishStoryData,
  PublishStoryResponses,
  UpdateStoryData,
  UpdateStoryRequest,
  UpdateStoryResponses,
} from '../generated/mapi/types.gen';
import type { Block as Component } from '../generated/types/block';
import type { MapiStory, StoryCreate, StoryUpdate } from '../generated/types/mapi-story';
import type { ApiResponse, FetchOptions, MapiResourceDeps } from '../client';
import { resolveSpaceId, type SpaceIdPathOverride } from './shared';

export type StoryListQuery = NonNullable<ListStoriesData['query']>;

/**
 * Resolves to a component-narrowed story type when `TComponents` is a specific
 * Component union, or falls back to the generated `MapiStory` when no components
 * are provided (i.e. `TComponents` is the default base `Component` type).
 */
type StoryResult<TComponents extends Component, TFieldPlugins = Record<never, never>> =
  Component extends TComponents
    ? MapiStory
    : MapiStory<TComponents, TFieldPlugins>;

type GetResponse<TComponents extends Component, TFieldPlugins = Record<never, never>> =
  Omit<GetStoryByIdResponses[200], 'story'> & { story?: StoryResult<TComponents, TFieldPlugins> };

type ListResponse<TComponents extends Component, TFieldPlugins = Record<never, never>> =
  Omit<ListStoriesResponses[200], 'stories'> & { stories?: Array<StoryResult<TComponents, TFieldPlugins>> };

type CreateResponse<TComponents extends Component, TFieldPlugins = Record<never, never>> =
  Omit<CreateStoryResponses[201], 'story'> & { story?: StoryResult<TComponents, TFieldPlugins> };

type UpdateResponse<TComponents extends Component, TFieldPlugins = Record<never, never>> =
  Omit<UpdateStoryResponses[200], 'story'> & { story?: StoryResult<TComponents, TFieldPlugins> };

type DuplicateResponse<TComponents extends Component, TFieldPlugins = Record<never, never>> =
  Omit<DuplicateStoryResponses[200], 'story'> & { story?: StoryResult<TComponents, TFieldPlugins> };

type PublishResponse<TComponents extends Component, TFieldPlugins = Record<never, never>> =
  Omit<PublishStoryResponses[200], 'story'> & { story?: StoryResult<TComponents, TFieldPlugins> };

type CreateBody<TComponents extends Component, TFieldPlugins = Record<never, never>> =
  Component extends TComponents
    ? CreateStoryData['body']
    : Omit<UpdateStoryRequest, 'story'> & {
      story: StoryCreate<TComponents, TFieldPlugins>;
    };

type UpdateBody<TComponents extends Component, TFieldPlugins = Record<never, never>> =
  Component extends TComponents
    ? UpdateStoryData['body']
    : Omit<UpdateStoryRequest, 'story'> & {
      story: StoryUpdate<TComponents, TFieldPlugins>;
    };

export function createStoriesResource<
  TComponents extends Component = Component,
  TFieldPlugins = Record<never, never>,
  DefaultThrowOnError extends boolean = false,
>(deps: MapiResourceDeps<DefaultThrowOnError>) {
  const { client, spaceId, wrapRequest } = deps;
  const getSpaceId = (path?: SpaceIdPathOverride['path']) => resolveSpaceId(spaceId, path);

  return {
    list<ThrowOnError extends boolean = DefaultThrowOnError>(options: { query?: ListStoriesData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {}): Promise<ApiResponse<ListResponse<TComponents, TFieldPlugins>, ThrowOnError>> {
      const { query, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<ListResponse<TComponents, TFieldPlugins>, ThrowOnError>(() =>
        mapi.listStories({ client, path: { space_id: resolvedSpaceId }, query, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    get<ThrowOnError extends boolean = DefaultThrowOnError>(storyId: number, options: { query?: GetStoryByIdData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {}): Promise<ApiResponse<GetResponse<TComponents, TFieldPlugins>, ThrowOnError>> {
      const { query, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<GetResponse<TComponents, TFieldPlugins>, ThrowOnError>(() =>
        mapi.getStoryById({ client, path: { space_id: resolvedSpaceId, id: storyId }, query, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    create<ThrowOnError extends boolean = DefaultThrowOnError>(options: { body: CreateBody<TComponents, TFieldPlugins>; query?: CreateStoryData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride): Promise<ApiResponse<CreateResponse<TComponents, TFieldPlugins>, ThrowOnError>> {
      const { body, query, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<CreateResponse<TComponents, TFieldPlugins>, ThrowOnError>(() =>
        mapi.createStory({ client, path: { space_id: resolvedSpaceId }, body: body as CreateStoryData['body'], query, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    update<ThrowOnError extends boolean = DefaultThrowOnError>(
      storyId: number,
      options: { body: UpdateBody<TComponents, TFieldPlugins>; query?: UpdateStoryData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride,
    ): Promise<ApiResponse<UpdateResponse<TComponents, TFieldPlugins>, ThrowOnError>> {
      const { body, query, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<UpdateResponse<TComponents, TFieldPlugins>, ThrowOnError>(() =>
        mapi.updateStory({ client, path: { space_id: resolvedSpaceId, id: storyId }, body: body as UpdateStoryData['body'], query, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    delete<ThrowOnError extends boolean = DefaultThrowOnError>(storyId: number, options: { signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {}): Promise<ApiResponse<DeleteStoryResponses[200], ThrowOnError>> {
      const { signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<DeleteStoryResponses[200], ThrowOnError>(() =>
        mapi.deleteStory({ client, path: { space_id: resolvedSpaceId, id: storyId }, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    duplicate<ThrowOnError extends boolean = DefaultThrowOnError>(
      storyId: number,
      options: { body: DuplicateStoryData['body']; query?: DuplicateStoryData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride,
    ): Promise<ApiResponse<DuplicateResponse<TComponents, TFieldPlugins>, ThrowOnError>> {
      const { body, query, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<DuplicateResponse<TComponents, TFieldPlugins>, ThrowOnError>(() =>
        mapi.duplicateStory({ client, path: { space_id: resolvedSpaceId, id: storyId }, body, query, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    publish<ThrowOnError extends boolean = DefaultThrowOnError>(
      storyId: number,
      options: { query?: PublishStoryData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {},
    ): Promise<ApiResponse<PublishResponse<TComponents, TFieldPlugins>, ThrowOnError>> {
      const { query, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<PublishResponse<TComponents, TFieldPlugins>, ThrowOnError>(() =>
        mapi.publishStory({ client, path: { space_id: resolvedSpaceId, id: storyId }, query, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    versions<ThrowOnError extends boolean = DefaultThrowOnError>(
      storyId: number,
      options: { query?: Omit<ListVersionsData['query'], 'model' | 'model_id'>; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {},
    ): Promise<ApiResponse<ListVersionsResponses[200], ThrowOnError>> {
      const { query, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<ListVersionsResponses[200], ThrowOnError>(() =>
        mapi.listVersions({ client, path: { space_id: resolvedSpaceId }, query: { ...query, model: 'stories', model_id: storyId }, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
  };
}
