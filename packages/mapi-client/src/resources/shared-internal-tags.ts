import type { ApiResponse, FetchOptions, MapiResourceDeps } from '../client';
import { resolveSpaceId, type SpaceIdPathOverride } from './shared';

export type SharedInternalTagObjectType = 'asset' | 'component' | 'idea';

export interface SharedInternalTag {
  id: number;
  name: string;
  object_type: SharedInternalTagObjectType;
  assets_count?: number;
}

export interface SharedInternalTagCreate {
  name: string;
  object_type: SharedInternalTagObjectType;
  /** The library root folder the tag is scoped to. Required on every call. */
  asset_folder_id: number;
}

export interface SharedInternalTagListQuery {
  /** The library root folder. Required. */
  asset_folder_id: number;
  search?: string;
  by_object_type?: string;
  by_ids?: string;
  page?: number;
  per_page?: number;
}

export interface SharedInternalTagListResponse {
  internal_tags: SharedInternalTag[];
}

export interface SharedInternalTagMutateResponse {
  internal_tag: SharedInternalTag;
}

/**
 * Shared (organization-level) internal tags, scoped to a library. Every method
 * carries `asset_folder_id` = library root (query param on list/delete, body
 * field on create/update). Not part of the generated SDK — raw `client.*`.
 */
export function createSharedInternalTagsResource<DefaultThrowOnError extends boolean = false>(deps: MapiResourceDeps<DefaultThrowOnError>) {
  const { client, spaceId, wrapRequest } = deps;
  const getSpaceId = (path?: SpaceIdPathOverride['path']) => resolveSpaceId(spaceId, path);
  const kyOpts = (fetchOptions?: FetchOptions) =>
    fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {};
  const maybeThrow = (throwOnError?: boolean) => (throwOnError === undefined ? {} : { throwOnError });

  return {
    list<ThrowOnError extends boolean = false>(options: { query: SharedInternalTagListQuery; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride): Promise<ApiResponse<SharedInternalTagListResponse, ThrowOnError>> {
      const { query, signal, path, throwOnError, fetchOptions } = options;
      return wrapRequest<SharedInternalTagListResponse, ThrowOnError>(() =>
        client.get({ url: '/v1/spaces/{space_id}/shared_internal_tags', path: { space_id: getSpaceId(path) }, query: { ...query }, signal, ...maybeThrow(throwOnError), ...kyOpts(fetchOptions) }), throwOnError);
    },
    create<ThrowOnError extends boolean = false>(options: { body: { shared_internal_tag: SharedInternalTagCreate }; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride): Promise<ApiResponse<SharedInternalTagMutateResponse, ThrowOnError>> {
      const { body, signal, path, throwOnError, fetchOptions } = options;
      return wrapRequest<SharedInternalTagMutateResponse, ThrowOnError>(() =>
        client.post({ url: '/v1/spaces/{space_id}/shared_internal_tags', path: { space_id: getSpaceId(path) }, body, signal, ...maybeThrow(throwOnError), ...kyOpts(fetchOptions) }), throwOnError);
    },
    update<ThrowOnError extends boolean = false>(tagId: number, options: { body: { shared_internal_tag: SharedInternalTagCreate }; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride): Promise<ApiResponse<SharedInternalTagMutateResponse, ThrowOnError>> {
      const { body, signal, path, throwOnError, fetchOptions } = options;
      return wrapRequest<SharedInternalTagMutateResponse, ThrowOnError>(() =>
        client.patch({ url: '/v1/spaces/{space_id}/shared_internal_tags/{internal_tag_id}', path: { space_id: getSpaceId(path), internal_tag_id: tagId }, body, signal, ...maybeThrow(throwOnError), ...kyOpts(fetchOptions) }), throwOnError);
    },
    delete<ThrowOnError extends boolean = false>(tagId: number, options: { query: { asset_folder_id: number }; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride): Promise<ApiResponse<void, ThrowOnError>> {
      const { query, signal, path, throwOnError, fetchOptions } = options;
      return wrapRequest<void, ThrowOnError>(() =>
        client.delete({ url: '/v1/spaces/{space_id}/shared_internal_tags/{internal_tag_id}', path: { space_id: getSpaceId(path), internal_tag_id: tagId }, query, signal, ...maybeThrow(throwOnError), ...kyOpts(fetchOptions) }), throwOnError);
    },
  };
}
