import * as spacesApi from '../generated/spaces/sdk.gen';
import type {
  CreateData,
  CreateResponses,
  DeleteResponses,
  GetResponses,
  ListData,
  ListResponses,
  UpdateData,
  UpdateResponses,
} from '../generated/spaces/types.gen';
import type { ApiResponse, FetchOptions, MapiResourceDeps } from '../client';
import { resolveSpaceId, type SpaceIdPathOverride } from './shared';

export function createSpacesResource<DefaultThrowOnError extends boolean = false>(deps: MapiResourceDeps<DefaultThrowOnError>) {
  const { client, spaceId, wrapRequest } = deps;
  const getSpaceId = (path?: SpaceIdPathOverride['path']) => resolveSpaceId(spaceId, path);

  return {
    list<ThrowOnError extends boolean = DefaultThrowOnError>(options: { query?: ListData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } = {}): Promise<ApiResponse<ListResponses[200], ThrowOnError>> {
      const { query, signal, throwOnError, fetchOptions } = options;
      return wrapRequest<ListResponses[200], ThrowOnError>(() =>
        spacesApi.list({ client, query, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    create<ThrowOnError extends boolean = DefaultThrowOnError>(options: { body: CreateData['body']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions }): Promise<ApiResponse<CreateResponses[201], ThrowOnError>> {
      const { body, signal, throwOnError, fetchOptions } = options;
      return wrapRequest<CreateResponses[201], ThrowOnError>(() =>
        spacesApi.create({ client, body, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    get<ThrowOnError extends boolean = DefaultThrowOnError>(options: { signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {}): Promise<ApiResponse<GetResponses[200], ThrowOnError>> {
      const { signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<GetResponses[200], ThrowOnError>(() =>
        spacesApi.get({ client, path: { space_id: resolvedSpaceId }, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    update<ThrowOnError extends boolean = DefaultThrowOnError>(options: { body: UpdateData['body']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride): Promise<ApiResponse<UpdateResponses[200], ThrowOnError>> {
      const { body, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<UpdateResponses[200], ThrowOnError>(() =>
        spacesApi.update({ client, path: { space_id: resolvedSpaceId }, body, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    delete<ThrowOnError extends boolean = DefaultThrowOnError>(options: { signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {}): Promise<ApiResponse<DeleteResponses[200], ThrowOnError>> {
      const { signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<DeleteResponses[200], ThrowOnError>(() =>
        spacesApi.delete_({ client, path: { space_id: resolvedSpaceId }, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
  };
}
