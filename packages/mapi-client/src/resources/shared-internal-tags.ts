import * as mapi from '../generated/mapi/sdk.gen';
import type {
  CreateSharedInternalTagResponses,
  DeleteSharedInternalTagData,
  ListSharedInternalTagsData,
  ListSharedInternalTagsResponses,
  SharedInternalTagRequest,
} from '../generated/mapi/types.gen';
import type { InternalTag } from '../generated/mapi/types-aliased.gen';
import type { ApiResponse, FetchOptions, MapiResourceDeps } from '../client';
import { resolveSpaceId, type SpaceIdPathOverride } from './shared';

export type SharedInternalTagObjectType = NonNullable<SharedInternalTagRequest['shared_internal_tag']['object_type']>;

export type SharedInternalTag = InternalTag;

export type SharedInternalTagCreate = SharedInternalTagRequest['shared_internal_tag'];

export type SharedInternalTagListQuery = ListSharedInternalTagsData['query'];

export type SharedInternalTagListResponse = ListSharedInternalTagsResponses[200];

export type SharedInternalTagMutateResponse = CreateSharedInternalTagResponses[200];

/**
 * Shared (organization-level) internal tags, scoped to a library. Every method
 * carries `asset_folder_id` = library root (query param on list/delete, body
 * field on create/update).
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
        mapi.listSharedInternalTags({ client, path: { space_id: getSpaceId(path) }, query, signal, ...maybeThrow(throwOnError), ...kyOpts(fetchOptions) }), throwOnError);
    },
    create<ThrowOnError extends boolean = false>(options: { body: { shared_internal_tag: SharedInternalTagCreate }; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride): Promise<ApiResponse<SharedInternalTagMutateResponse, ThrowOnError>> {
      const { body, signal, path, throwOnError, fetchOptions } = options;
      return wrapRequest<SharedInternalTagMutateResponse, ThrowOnError>(() =>
        mapi.createSharedInternalTag({ client, path: { space_id: getSpaceId(path) }, body, signal, ...maybeThrow(throwOnError), ...kyOpts(fetchOptions) }), throwOnError);
    },
    update<ThrowOnError extends boolean = false>(tagId: number, options: { body: { shared_internal_tag: SharedInternalTagCreate }; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride): Promise<ApiResponse<SharedInternalTagMutateResponse, ThrowOnError>> {
      const { body, signal, path, throwOnError, fetchOptions } = options;
      return wrapRequest<SharedInternalTagMutateResponse, ThrowOnError>(() =>
        mapi.updateSharedInternalTag({ client, path: { space_id: getSpaceId(path), id: tagId }, body, signal, ...maybeThrow(throwOnError), ...kyOpts(fetchOptions) }), throwOnError);
    },
    delete<ThrowOnError extends boolean = false>(tagId: number, options: { query: DeleteSharedInternalTagData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride): Promise<ApiResponse<void, ThrowOnError>> {
      const { query, signal, path, throwOnError, fetchOptions } = options;
      return wrapRequest<void, ThrowOnError>(() =>
        mapi.deleteSharedInternalTag({ client, path: { space_id: getSpaceId(path), id: tagId }, query, signal, ...maybeThrow(throwOnError), ...kyOpts(fetchOptions) }), throwOnError);
    },
  };
}
