import * as mapi from '../generated/mapi/sdk.gen';
import type {
  CreateComponentData,
  CreateComponentResponses,
  DeleteComponentResponses,
  GetComponentResponses,
  GetComponentVersionData,
  GetComponentVersionResponses,
  ListManagementComponentsData,
  ListManagementComponentsResponses,
  ListVersionsData,
  ListVersionsResponses,
  RestoreComponentResponses,
  RestoreVersionData,
  RestoreVersionResponses,
  UpdateComponentData,
  UpdateComponentResponses,
} from '../generated/mapi/types.gen';
import type { Component } from '../generated/mapi/types-aliased.gen';
import type { ApiResponse, FetchOptions, MapiResourceDeps } from '../client';
import { resolveSpaceId, type SpaceIdPathOverride } from './shared';

// Component definitions are MAPI wire shapes (a `schema` record), surfaced as the
// public `Component`. This is distinct from the DSL `fields` blocks used to narrow
// story content via `.withTypes()` — definitions are not parameterised by the block
// registry.
type ListComponentsResult = Omit<ListManagementComponentsResponses[200], 'components'> & { components: Component[] };
type GetComponentResult = Omit<GetComponentResponses[200], 'component'> & { component: Component };
type CreateComponentResult = Omit<CreateComponentResponses[201], 'component'> & { component: Component };
type UpdateComponentResult = Omit<UpdateComponentResponses[200], 'component'> & { component: Component };
type RestoreComponentResult = Omit<RestoreComponentResponses[200], 'component'> & { component: Component };

export function createComponentsResource<
  DefaultThrowOnError extends boolean = false,
>(deps: MapiResourceDeps<DefaultThrowOnError>) {
  const { client, spaceId, wrapRequest } = deps;
  const getSpaceId = (path?: SpaceIdPathOverride['path']) => resolveSpaceId(spaceId, path);

  return {
    list<ThrowOnError extends boolean = DefaultThrowOnError>(options: { query?: ListManagementComponentsData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {}): Promise<ApiResponse<ListComponentsResult, ThrowOnError>> {
      const { query, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<ListComponentsResult, ThrowOnError>(() =>
        mapi.listManagementComponents({ client, path: { space_id: resolvedSpaceId }, query, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    get<ThrowOnError extends boolean = DefaultThrowOnError>(componentId: number, options: { signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {}): Promise<ApiResponse<GetComponentResult, ThrowOnError>> {
      const { signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<GetComponentResult, ThrowOnError>(() =>
        mapi.getComponent({ client, path: { space_id: resolvedSpaceId, id: String(componentId) }, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    create<ThrowOnError extends boolean = DefaultThrowOnError>(options: { body: CreateComponentData['body']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride): Promise<ApiResponse<CreateComponentResult, ThrowOnError>> {
      const { body, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<CreateComponentResult, ThrowOnError>(() =>
        mapi.createComponent({ client, path: { space_id: resolvedSpaceId }, body, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    update<ThrowOnError extends boolean = DefaultThrowOnError>(
      componentId: number,
      options: { body: UpdateComponentData['body']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride,
    ): Promise<ApiResponse<UpdateComponentResult, ThrowOnError>> {
      const { body, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<UpdateComponentResult, ThrowOnError>(() =>
        mapi.updateComponent({ client, path: { space_id: resolvedSpaceId, id: String(componentId) }, body, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    delete<ThrowOnError extends boolean = DefaultThrowOnError>(componentId: number, options: { signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {}): Promise<ApiResponse<DeleteComponentResponses[200], ThrowOnError>> {
      const { signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<DeleteComponentResponses[200], ThrowOnError>(() =>
        mapi.deleteComponent({ client, path: { space_id: resolvedSpaceId, id: String(componentId) }, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    restore<ThrowOnError extends boolean = DefaultThrowOnError>(componentId: number, options: { signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {}): Promise<ApiResponse<RestoreComponentResult, ThrowOnError>> {
      const { signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<RestoreComponentResult, ThrowOnError>(() =>
        mapi.restoreComponent({ client, path: { space_id: resolvedSpaceId, id: componentId }, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    versions<ThrowOnError extends boolean = DefaultThrowOnError>(
      componentId: number,
      options: { query?: Omit<ListVersionsData['query'], 'model' | 'model_id'>; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {},
    ): Promise<ApiResponse<ListVersionsResponses[200], ThrowOnError>> {
      const { query, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<ListVersionsResponses[200], ThrowOnError>(() =>
        mapi.listVersions({ client, path: { space_id: resolvedSpaceId }, query: { ...query, model: 'components', model_id: componentId }, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    version<ThrowOnError extends boolean = DefaultThrowOnError>(
      componentId: number,
      versionId: GetComponentVersionData['path']['id'],
      options: { signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {},
    ): Promise<ApiResponse<GetComponentVersionResponses[200], ThrowOnError>> {
      const { signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<GetComponentVersionResponses[200], ThrowOnError>(() =>
        mapi.getComponentVersion({
          client,
          path: { space_id: resolvedSpaceId, component_id: componentId, id: versionId },
          signal,
          ...(throwOnError === undefined ? {} : { throwOnError }),
          ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}),
        }), throwOnError);
    },
    restoreVersion<ThrowOnError extends boolean = DefaultThrowOnError>(
      componentId: number,
      versionId: RestoreVersionData['path']['id'],
      options: { query?: Omit<RestoreVersionData['query'], 'model' | 'model_id'>; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {},
    ): Promise<ApiResponse<RestoreVersionResponses[204], ThrowOnError>> {
      const { query, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<RestoreVersionResponses[204], ThrowOnError>(() =>
        mapi.restoreVersion({ client, path: { space_id: resolvedSpaceId, id: versionId }, query: { ...query, model: 'components', model_id: componentId }, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
  };
}
