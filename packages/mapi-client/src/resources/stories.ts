import * as storiesApi from '../generated/stories/sdk.gen';
import type {
  CreateData,
  CreateResponses,
  DuplicateData,
  DuplicateResponses,
  GetAllData,
  GetAllResponses,
  GetData,
  GetResponses,
  PublishData,
  PublishResponses,
  RemoveResponses,
  UpdateData,
  UpdateResponses,
  VersionsData,
  VersionsResponses,
} from '../generated/stories/types.gen';
import type { ApiResponse, MapiResourceDeps } from '../index';
import { resolveSpaceId, type SpaceIdPathOverride } from './shared';

export function createStoriesResource(deps: MapiResourceDeps) {
  const { client, spaceId, wrapRequest } = deps;
  const getSpaceId = (path?: SpaceIdPathOverride['path']) => resolveSpaceId(spaceId, path);

  return {
    getAll<ThrowOnError extends boolean = false>(options: { query?: GetAllData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError } & SpaceIdPathOverride = {}): Promise<ApiResponse<GetAllResponses[200], ThrowOnError>> {
      const { query, signal, path, throwOnError } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<GetAllResponses[200], ThrowOnError>(() =>
        storiesApi.getAll({ client, path: { space_id: resolvedSpaceId }, query, signal, ...(throwOnError === undefined ? {} : { throwOnError }) }), throwOnError);
    },
    get<ThrowOnError extends boolean = false>(storyId: number | string, options: { query?: GetData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError } & SpaceIdPathOverride = {}): Promise<ApiResponse<GetResponses[200], ThrowOnError>> {
      const { query, signal, path, throwOnError } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<GetResponses[200], ThrowOnError>(() =>
        storiesApi.get({ client, path: { space_id: resolvedSpaceId, story_id: storyId }, query, signal, ...(throwOnError === undefined ? {} : { throwOnError }) }), throwOnError);
    },
    create<ThrowOnError extends boolean = false>(options: { body: CreateData['body']; query?: CreateData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError } & SpaceIdPathOverride): Promise<ApiResponse<CreateResponses[201], ThrowOnError>> {
      const { body, query, signal, path, throwOnError } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<CreateResponses[201], ThrowOnError>(() =>
        storiesApi.create({ client, path: { space_id: resolvedSpaceId }, body, query, signal, ...(throwOnError === undefined ? {} : { throwOnError }) }), throwOnError);
    },
    update<ThrowOnError extends boolean = false>(
      storyId: number | string,
      options: { body: UpdateData['body']; query?: UpdateData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError } & SpaceIdPathOverride,
    ): Promise<ApiResponse<UpdateResponses[200], ThrowOnError>> {
      const { body, query, signal, path, throwOnError } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<UpdateResponses[200], ThrowOnError>(() =>
        storiesApi.update({ client, path: { space_id: resolvedSpaceId, story_id: storyId }, body, query, signal, ...(throwOnError === undefined ? {} : { throwOnError }) }), throwOnError);
    },
    remove<ThrowOnError extends boolean = false>(storyId: number | string, options: { signal?: AbortSignal; throwOnError?: ThrowOnError } & SpaceIdPathOverride = {}): Promise<ApiResponse<RemoveResponses[200], ThrowOnError>> {
      const { signal, path, throwOnError } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<RemoveResponses[200], ThrowOnError>(() =>
        storiesApi.remove({ client, path: { space_id: resolvedSpaceId, story_id: storyId }, signal, ...(throwOnError === undefined ? {} : { throwOnError }) }), throwOnError);
    },
    duplicate<ThrowOnError extends boolean = false>(
      storyId: number | string,
      options: { body: DuplicateData['body']; query?: DuplicateData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError } & SpaceIdPathOverride,
    ): Promise<ApiResponse<DuplicateResponses[200], ThrowOnError>> {
      const { body, query, signal, path, throwOnError } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<DuplicateResponses[200], ThrowOnError>(() =>
        storiesApi.duplicate({ client, path: { space_id: resolvedSpaceId, story_id: storyId }, body, query, signal, ...(throwOnError === undefined ? {} : { throwOnError }) }), throwOnError);
    },
    publish<ThrowOnError extends boolean = false>(
      storyId: number | string,
      options: { query?: PublishData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError } & SpaceIdPathOverride = {},
    ): Promise<ApiResponse<PublishResponses[200], ThrowOnError>> {
      const { query, signal, path, throwOnError } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<PublishResponses[200], ThrowOnError>(() =>
        storiesApi.publish({ client, path: { space_id: resolvedSpaceId, story_id: storyId }, query, signal, ...(throwOnError === undefined ? {} : { throwOnError }) }), throwOnError);
    },
    versions<ThrowOnError extends boolean = false>(
      options: { query?: VersionsData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError } & SpaceIdPathOverride = {},
    ): Promise<ApiResponse<VersionsResponses[200], ThrowOnError>> {
      const { query, signal, path, throwOnError } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<VersionsResponses[200], ThrowOnError>(() =>
        storiesApi.versions({ client, path: { space_id: resolvedSpaceId }, query, signal, ...(throwOnError === undefined ? {} : { throwOnError }) }), throwOnError);
    },
  };
}
