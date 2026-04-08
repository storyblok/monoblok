import * as componentsApi from '../generated/components/sdk.gen';
import type {
  CreateData,
  CreateResponses,
  DeleteResponses,
  GetResponses,
  ListData,
  ListResponses,
  RestoreResponses,
  RestoreVersionData,
  RestoreVersionResponses,
  UpdateData,
  UpdateResponses,
  VersionData,
  VersionResponses,
  VersionsData,
  VersionsResponses,
} from '../generated/components/types.gen';
import type { ApiResponse, FetchOptions, MapiResourceDeps } from '../client';
import { resolveSpaceId, type SpaceIdPathOverride } from './shared';
import type { ComponentCreate as SchemaComponentCreate, ComponentUpdate as SchemaComponentUpdate } from '@storyblok/schema/mapi';

/**
 * Body type for component creation that accepts schema types.
 *
 * The `@storyblok/schema/mapi` package generates `ComponentCreate` with a
 * differently-shaped `ComponentSchemaField` union than the mapi-client's own
 * generated type. This bridge type uses the schema type so that output from
 * `defineComponentCreate()` is directly assignable.
 */
type ComponentCreateBody = Omit<CreateData['body'], 'component'> & { component?: SchemaComponentCreate };

/**
 * Body type for component updates that accepts schema types.
 * See {@link ComponentCreateBody} for rationale.
 */
type ComponentUpdateBody = Omit<UpdateData['body'], 'component'> & { component?: SchemaComponentUpdate };

export function createComponentsResource<DefaultThrowOnError extends boolean = false>(deps: MapiResourceDeps<DefaultThrowOnError>) {
  const { client, spaceId, wrapRequest } = deps;
  const getSpaceId = (path?: SpaceIdPathOverride['path']) => resolveSpaceId(spaceId, path);

  return {
    list<ThrowOnError extends boolean = DefaultThrowOnError>(options: { query?: ListData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {}): Promise<ApiResponse<ListResponses[200], ThrowOnError>> {
      const { query, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<ListResponses[200], ThrowOnError>(() =>
        componentsApi.list({ client, path: { space_id: resolvedSpaceId }, query, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    get<ThrowOnError extends boolean = DefaultThrowOnError>(componentId: number | string, options: { signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {}): Promise<ApiResponse<GetResponses[200], ThrowOnError>> {
      const { signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<GetResponses[200], ThrowOnError>(() =>
        componentsApi.get({ client, path: { space_id: resolvedSpaceId, component_id: componentId }, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    create<ThrowOnError extends boolean = DefaultThrowOnError>(options: { body: ComponentCreateBody; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride): Promise<ApiResponse<CreateResponses[201], ThrowOnError>> {
      const { body, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<CreateResponses[201], ThrowOnError>(() =>
        componentsApi.create({ client, path: { space_id: resolvedSpaceId }, body: body as CreateData['body'], signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    update<ThrowOnError extends boolean = DefaultThrowOnError>(
      componentId: number | string,
      options: { body: ComponentUpdateBody; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride,
    ): Promise<ApiResponse<UpdateResponses[200], ThrowOnError>> {
      const { body, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<UpdateResponses[200], ThrowOnError>(() =>
        componentsApi.update({ client, path: { space_id: resolvedSpaceId, component_id: componentId }, body: body as UpdateData['body'], signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    delete<ThrowOnError extends boolean = DefaultThrowOnError>(componentId: number | string, options: { signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {}): Promise<ApiResponse<DeleteResponses[200], ThrowOnError>> {
      const { signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<DeleteResponses[200], ThrowOnError>(() =>
        componentsApi.delete_({ client, path: { space_id: resolvedSpaceId, component_id: componentId }, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    restore<ThrowOnError extends boolean = DefaultThrowOnError>(componentId: number | string, options: { signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {}): Promise<ApiResponse<RestoreResponses[200], ThrowOnError>> {
      const { signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<RestoreResponses[200], ThrowOnError>(() =>
        componentsApi.restore({ client, path: { space_id: resolvedSpaceId, component_id: componentId }, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    versions<ThrowOnError extends boolean = DefaultThrowOnError>(options: { query?: VersionsData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {}): Promise<ApiResponse<VersionsResponses[200], ThrowOnError>> {
      const { query, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<VersionsResponses[200], ThrowOnError>(() =>
        componentsApi.versions({ client, path: { space_id: resolvedSpaceId }, query, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    version<ThrowOnError extends boolean = DefaultThrowOnError>(
      componentId: number | string,
      versionId: VersionData['path']['version_id'],
      options: { signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {},
    ): Promise<ApiResponse<VersionResponses[200], ThrowOnError>> {
      const { signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<VersionResponses[200], ThrowOnError>(() =>
        componentsApi.version({
          client,
          path: { space_id: resolvedSpaceId, component_id: componentId, version_id: versionId },
          signal,
          ...(throwOnError === undefined ? {} : { throwOnError }),
          ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}),
        }), throwOnError);
    },
    restoreVersion<ThrowOnError extends boolean = DefaultThrowOnError>(
      versionId: RestoreVersionData['path']['version_id'],
      options: { body: RestoreVersionData['body']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride,
    ): Promise<ApiResponse<RestoreVersionResponses[200], ThrowOnError>> {
      const { body, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<RestoreVersionResponses[200], ThrowOnError>(() =>
        componentsApi.restoreVersion({ client, path: { space_id: resolvedSpaceId, version_id: versionId }, body, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
  };
}
