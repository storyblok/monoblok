import * as spacesApi from '../generated/spaces/sdk.gen';
import type {
  CreateData,
  CreateResponses,
  GetAllData,
  GetAllResponses,
  GetResponses,
  RemoveResponses,
  UpdateData,
  UpdateResponses,
} from '../generated/spaces/types.gen';
import type { ApiResponse, MapiResourceDeps } from '../index';
import { resolveSpaceId, type SpaceIdPathOverride } from './shared';

export function createSpacesResource(deps: MapiResourceDeps) {
  const { client, spaceId, wrapRequest } = deps;
  const getSpaceId = (path?: SpaceIdPathOverride['path']) => resolveSpaceId(spaceId, path);

  return {
    getAll<ThrowOnError extends boolean = false>(options: { query?: GetAllData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError } = {}): Promise<ApiResponse<GetAllResponses[200], ThrowOnError>> {
      const { query, signal, throwOnError } = options;
      return wrapRequest<GetAllResponses[200], ThrowOnError>(() =>
        spacesApi.getAll({ client, query, signal, ...(throwOnError === undefined ? {} : { throwOnError }) }), throwOnError);
    },
    create<ThrowOnError extends boolean = false>(options: { body: CreateData['body']; signal?: AbortSignal; throwOnError?: ThrowOnError }): Promise<ApiResponse<CreateResponses[201], ThrowOnError>> {
      const { body, signal, throwOnError } = options;
      return wrapRequest<CreateResponses[201], ThrowOnError>(() =>
        spacesApi.create({ client, body, signal, ...(throwOnError === undefined ? {} : { throwOnError }) }), throwOnError);
    },
    get<ThrowOnError extends boolean = false>(options: { signal?: AbortSignal; throwOnError?: ThrowOnError } & SpaceIdPathOverride = {}): Promise<ApiResponse<GetResponses[200], ThrowOnError>> {
      const { signal, path, throwOnError } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<GetResponses[200], ThrowOnError>(() =>
        spacesApi.get({ client, path: { space_id: resolvedSpaceId }, signal, ...(throwOnError === undefined ? {} : { throwOnError }) }), throwOnError);
    },
    update<ThrowOnError extends boolean = false>(options: { body: UpdateData['body']; signal?: AbortSignal; throwOnError?: ThrowOnError } & SpaceIdPathOverride): Promise<ApiResponse<UpdateResponses[200], ThrowOnError>> {
      const { body, signal, path, throwOnError } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<UpdateResponses[200], ThrowOnError>(() =>
        spacesApi.update({ client, path: { space_id: resolvedSpaceId }, body, signal, ...(throwOnError === undefined ? {} : { throwOnError }) }), throwOnError);
    },
    remove<ThrowOnError extends boolean = false>(options: { signal?: AbortSignal; throwOnError?: ThrowOnError } & SpaceIdPathOverride = {}): Promise<ApiResponse<RemoveResponses[200], ThrowOnError>> {
      const { signal, path, throwOnError } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<RemoveResponses[200], ThrowOnError>(() =>
        spacesApi.remove({ client, path: { space_id: resolvedSpaceId }, signal, ...(throwOnError === undefined ? {} : { throwOnError }) }), throwOnError);
    },
  };
}
