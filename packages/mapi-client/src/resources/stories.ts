import * as storiesApi from '../generated/stories/sdk.gen';
import type {
  CreateData,
  CreateResponses,
  DeleteResponses,
  DuplicateData,
  DuplicateResponses,
  GetData,
  GetResponses,
  ListData,
  ListResponses,
  PublishData,
  PublishResponses,
  StoryCreateRequest,
  StoryMapi,
  StoryUpdateRequest,
  UpdateData,
  UpdateResponses,
  VersionsData,
  VersionsResponses,
} from '../generated/stories/types.gen';
import type { ApiResponse, FetchOptions, MapiResourceDeps } from '../client';
import { resolveSpaceId, type SpaceIdPathOverride } from './shared';
import type { Block as Component } from '@storyblok/schema';
import type { Story as MapiStory, StoryCreate as MapiStoryCreate, StoryUpdate as MapiStoryUpdate } from '@storyblok/schema/mapi';

export type StoryListQuery = NonNullable<ListData['query']>;

/**
 * Resolves to a component-narrowed story type when `TComponents` is a specific
 * Component union, or falls back to the generated `StoryMapi` when no components
 * are provided (i.e. `TComponents` is the default base `Component` type).
 *
 * Delegates to `MapiStory<TComponents>` single-generic mode which internally
 * handles the `RootComponents` filtering and discriminated union construction.
 */
type StoryResult<TComponents extends Component> =
  Component extends TComponents
    ? StoryMapi // fallback: no components provided
    : MapiStory<TComponents>;

type GetResponse<TComponents extends Component> =
  Omit<GetResponses[200], 'story'> & { story?: StoryResult<TComponents> };

type ListResponse<TComponents extends Component> =
  Omit<ListResponses[200], 'stories'> & { stories?: Array<StoryResult<TComponents>> };

type CreateResponse<TComponents extends Component> =
  Omit<CreateResponses[201], 'story'> & { story?: StoryResult<TComponents> };

type UpdateResponse<TComponents extends Component> =
  Omit<UpdateResponses[200], 'story'> & { story?: StoryResult<TComponents> };

type DuplicateResponse<TComponents extends Component> =
  Omit<DuplicateResponses[200], 'story'> & { story?: StoryResult<TComponents> };

type PublishResponse<TComponents extends Component> =
  Omit<PublishResponses[200], 'story'> & { story?: StoryResult<TComponents> };

/**
 * Component-narrowed body for story creation. When `TComponents` is provided,
 * `body.story.content` is typed to the narrowed union of root component content types.
 * Falls back to the generated `StoryCreateRequest` when no components are provided.
 */
type CreateBody<TComponents extends Component> =
  Component extends TComponents
    ? CreateData['body']
    : Omit<StoryCreateRequest, 'story'> & {
      story: MapiStoryCreate<TComponents>;
    };

/**
 * Component-narrowed body for story updates. When `TComponents` is provided,
 * `body.story.content` is typed to the narrowed union of root component content types.
 * Falls back to the generated `StoryUpdateRequest` when no components are provided.
 */
type UpdateBody<TComponents extends Component> =
  Component extends TComponents
    ? UpdateData['body']
    : Omit<StoryUpdateRequest, 'story'> & {
      story: MapiStoryUpdate<TComponents>;
    };

export function createStoriesResource<
  TComponents extends Component = Component,
  DefaultThrowOnError extends boolean = false,
>(deps: MapiResourceDeps<DefaultThrowOnError>) {
  const { client, spaceId, wrapRequest } = deps;
  const getSpaceId = (path?: SpaceIdPathOverride['path']) => resolveSpaceId(spaceId, path);

  return {
    list<ThrowOnError extends boolean = DefaultThrowOnError>(options: { query?: ListData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {}): Promise<ApiResponse<ListResponse<TComponents>, ThrowOnError>> {
      const { query, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<ListResponse<TComponents>, ThrowOnError>(() =>
        storiesApi.list({ client, path: { space_id: resolvedSpaceId }, query, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    get<ThrowOnError extends boolean = DefaultThrowOnError>(storyId: number | string, options: { query?: GetData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {}): Promise<ApiResponse<GetResponse<TComponents>, ThrowOnError>> {
      const { query, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<GetResponse<TComponents>, ThrowOnError>(() =>
        storiesApi.get({ client, path: { space_id: resolvedSpaceId, story_id: storyId }, query, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    create<ThrowOnError extends boolean = DefaultThrowOnError>(options: { body: CreateBody<TComponents>; query?: CreateData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride): Promise<ApiResponse<CreateResponse<TComponents>, ThrowOnError>> {
      const { body, query, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<CreateResponse<TComponents>, ThrowOnError>(() =>
        storiesApi.create({ client, path: { space_id: resolvedSpaceId }, body: body as CreateData['body'], query, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    update<ThrowOnError extends boolean = DefaultThrowOnError>(
      storyId: number | string,
      options: { body: UpdateBody<TComponents>; query?: UpdateData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride,
    ): Promise<ApiResponse<UpdateResponse<TComponents>, ThrowOnError>> {
      const { body, query, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<UpdateResponse<TComponents>, ThrowOnError>(() =>
        storiesApi.update({ client, path: { space_id: resolvedSpaceId, story_id: storyId }, body: body as UpdateData['body'], query, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    delete<ThrowOnError extends boolean = DefaultThrowOnError>(storyId: number | string, options: { signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {}): Promise<ApiResponse<DeleteResponses[200], ThrowOnError>> {
      const { signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<DeleteResponses[200], ThrowOnError>(() =>
        storiesApi.delete_({ client, path: { space_id: resolvedSpaceId, story_id: storyId }, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    duplicate<ThrowOnError extends boolean = DefaultThrowOnError>(
      storyId: number | string,
      options: { body: DuplicateData['body']; query?: DuplicateData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride,
    ): Promise<ApiResponse<DuplicateResponse<TComponents>, ThrowOnError>> {
      const { body, query, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<DuplicateResponse<TComponents>, ThrowOnError>(() =>
        storiesApi.duplicate({ client, path: { space_id: resolvedSpaceId, story_id: storyId }, body, query, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    publish<ThrowOnError extends boolean = DefaultThrowOnError>(
      storyId: number | string,
      options: { query?: PublishData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {},
    ): Promise<ApiResponse<PublishResponse<TComponents>, ThrowOnError>> {
      const { query, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<PublishResponse<TComponents>, ThrowOnError>(() =>
        storiesApi.publish({ client, path: { space_id: resolvedSpaceId, story_id: storyId }, query, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    versions<ThrowOnError extends boolean = DefaultThrowOnError>(
      options: { query?: VersionsData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {},
    ): Promise<ApiResponse<VersionsResponses[200], ThrowOnError>> {
      const { query, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<VersionsResponses[200], ThrowOnError>(() =>
        storiesApi.versions({ client, path: { space_id: resolvedSpaceId }, query, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
  };
}
