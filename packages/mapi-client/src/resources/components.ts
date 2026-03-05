import * as componentsApi from '../generated/components/sdk.gen';
import type {
  BulkMoveData,
  BulkMoveResponses,
  CreateData,
  CreateResponses,
  GetAllData,
  GetAllResponses,
  GetResponses,
  RemoveResponses,
  RenameAttributeData,
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
import type { ApiResponse, MapiResourceDeps } from '../index';
import { resolveSpaceId, type SpaceIdPathOverride } from './shared';

export function createComponentsResource(deps: MapiResourceDeps) {
  const { client, spaceId, wrapRequest } = deps;
  const getSpaceId = (path?: SpaceIdPathOverride['path']) => resolveSpaceId(spaceId, path);

  return {
    getAll<ThrowOnError extends boolean = false>(options: { query?: GetAllData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError } & SpaceIdPathOverride = {}): Promise<ApiResponse<GetAllResponses[200], ThrowOnError>> {
      const { query, signal, path, throwOnError } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<GetAllResponses[200], ThrowOnError>(() =>
        componentsApi.getAll({ client, path: { space_id: resolvedSpaceId }, query, signal, ...(throwOnError === undefined ? {} : { throwOnError }) }), throwOnError);
    },
    get<ThrowOnError extends boolean = false>(componentId: number | string, options: { signal?: AbortSignal; throwOnError?: ThrowOnError } & SpaceIdPathOverride = {}): Promise<ApiResponse<GetResponses[200], ThrowOnError>> {
      const { signal, path, throwOnError } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<GetResponses[200], ThrowOnError>(() =>
        componentsApi.get({ client, path: { space_id: resolvedSpaceId, component_id: componentId }, signal, ...(throwOnError === undefined ? {} : { throwOnError }) }), throwOnError);
    },
    create<ThrowOnError extends boolean = false>(options: { body: CreateData['body']; signal?: AbortSignal; throwOnError?: ThrowOnError } & SpaceIdPathOverride): Promise<ApiResponse<CreateResponses[201], ThrowOnError>> {
      const { body, signal, path, throwOnError } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<CreateResponses[201], ThrowOnError>(() =>
        componentsApi.create({ client, path: { space_id: resolvedSpaceId }, body, signal, ...(throwOnError === undefined ? {} : { throwOnError }) }), throwOnError);
    },
    update<ThrowOnError extends boolean = false>(
      componentId: number | string,
      options: { body: UpdateData['body']; signal?: AbortSignal; throwOnError?: ThrowOnError } & SpaceIdPathOverride,
    ): Promise<ApiResponse<UpdateResponses[200], ThrowOnError>> {
      const { body, signal, path, throwOnError } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<UpdateResponses[200], ThrowOnError>(() =>
        componentsApi.update({ client, path: { space_id: resolvedSpaceId, component_id: componentId }, body, signal, ...(throwOnError === undefined ? {} : { throwOnError }) }), throwOnError);
    },
    remove<ThrowOnError extends boolean = false>(componentId: number | string, options: { signal?: AbortSignal; throwOnError?: ThrowOnError } & SpaceIdPathOverride = {}): Promise<ApiResponse<RemoveResponses[200], ThrowOnError>> {
      const { signal, path, throwOnError } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<RemoveResponses[200], ThrowOnError>(() =>
        componentsApi.remove({ client, path: { space_id: resolvedSpaceId, component_id: componentId }, signal, ...(throwOnError === undefined ? {} : { throwOnError }) }), throwOnError);
    },
    renameAttribute<ThrowOnError extends boolean = false>(
      componentId: number | string,
      options: { query: RenameAttributeData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError } & SpaceIdPathOverride,
    ): Promise<ApiResponse<void, ThrowOnError>> {
      const { query, signal, path, throwOnError } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<void, ThrowOnError>(() =>
        componentsApi.renameAttribute({ client, path: { space_id: resolvedSpaceId, component_id: componentId }, query, signal, ...(throwOnError === undefined ? {} : { throwOnError }) }), throwOnError);
    },
    restore<ThrowOnError extends boolean = false>(componentId: number | string, options: { signal?: AbortSignal; throwOnError?: ThrowOnError } & SpaceIdPathOverride = {}): Promise<ApiResponse<RestoreResponses[200], ThrowOnError>> {
      const { signal, path, throwOnError } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<RestoreResponses[200], ThrowOnError>(() =>
        componentsApi.restore({ client, path: { space_id: resolvedSpaceId, component_id: componentId }, signal, ...(throwOnError === undefined ? {} : { throwOnError }) }), throwOnError);
    },
    bulkMove<ThrowOnError extends boolean = false>(options: { body: BulkMoveData['body']; signal?: AbortSignal; throwOnError?: ThrowOnError } & SpaceIdPathOverride): Promise<ApiResponse<BulkMoveResponses[200], ThrowOnError>> {
      const { body, signal, path, throwOnError } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<BulkMoveResponses[200], ThrowOnError>(() =>
        componentsApi.bulkMove({ client, path: { space_id: resolvedSpaceId }, body, signal, ...(throwOnError === undefined ? {} : { throwOnError }) }), throwOnError);
    },
    versions<ThrowOnError extends boolean = false>(options: { query?: VersionsData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError } & SpaceIdPathOverride = {}): Promise<ApiResponse<VersionsResponses[200], ThrowOnError>> {
      const { query, signal, path, throwOnError } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<VersionsResponses[200], ThrowOnError>(() =>
        componentsApi.versions({ client, path: { space_id: resolvedSpaceId }, query, signal, ...(throwOnError === undefined ? {} : { throwOnError }) }), throwOnError);
    },
    version<ThrowOnError extends boolean = false>(
      componentId: number | string,
      versionId: VersionData['path']['version_id'],
      options: { signal?: AbortSignal; throwOnError?: ThrowOnError } & SpaceIdPathOverride = {},
    ): Promise<ApiResponse<VersionResponses[200], ThrowOnError>> {
      const { signal, path, throwOnError } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<VersionResponses[200], ThrowOnError>(() =>
        componentsApi.version({
          client,
          path: { space_id: resolvedSpaceId, component_id: componentId, version_id: versionId },
          signal,
          ...(throwOnError === undefined ? {} : { throwOnError }),
        }), throwOnError);
    },
    restoreVersion<ThrowOnError extends boolean = false>(
      versionId: RestoreVersionData['path']['version_id'],
      options: { body: RestoreVersionData['body']; signal?: AbortSignal; throwOnError?: ThrowOnError } & SpaceIdPathOverride,
    ): Promise<ApiResponse<RestoreVersionResponses[200], ThrowOnError>> {
      const { body, signal, path, throwOnError } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<RestoreVersionResponses[200], ThrowOnError>(() =>
        componentsApi.restoreVersion({ client, path: { space_id: resolvedSpaceId, version_id: versionId }, body, signal, ...(throwOnError === undefined ? {} : { throwOnError }) }), throwOnError);
    },
  };
}
