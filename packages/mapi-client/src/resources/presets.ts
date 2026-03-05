import * as presetsApi from '../generated/presets/sdk.gen';
import type {
  CreateData,
  CreateResponses,
  GetAllData,
  GetAllResponses,
  GetResponses,
  RemoveResponses,
  UpdateData,
  UpdateResponses,
} from '../generated/presets/types.gen';
import type { ApiResponse, MapiResourceDeps } from '../index';
import { resolveSpaceId, type SpaceIdPathOverride } from './shared';

export function createPresetsResource(deps: MapiResourceDeps) {
  const { client, spaceId, wrapRequest } = deps;
  const getSpaceId = (path?: SpaceIdPathOverride['path']) => resolveSpaceId(spaceId, path);

  return {
    getAll<ThrowOnError extends boolean = false>(options: { query?: GetAllData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError } & SpaceIdPathOverride = {}): Promise<ApiResponse<GetAllResponses[200], ThrowOnError>> {
      const { query, signal, path, throwOnError } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<GetAllResponses[200], ThrowOnError>(() =>
        presetsApi.getAll({ client, path: { space_id: resolvedSpaceId }, query, signal, ...(throwOnError === undefined ? {} : { throwOnError }) }), throwOnError);
    },
    get<ThrowOnError extends boolean = false>(presetId: number | string, options: { signal?: AbortSignal; throwOnError?: ThrowOnError } & SpaceIdPathOverride = {}): Promise<ApiResponse<GetResponses[200], ThrowOnError>> {
      const { signal, path, throwOnError } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<GetResponses[200], ThrowOnError>(() =>
        presetsApi.get({ client, path: { space_id: resolvedSpaceId, preset_id: presetId }, signal, ...(throwOnError === undefined ? {} : { throwOnError }) }), throwOnError);
    },
    create<ThrowOnError extends boolean = false>(options: { body: CreateData['body']; signal?: AbortSignal; throwOnError?: ThrowOnError } & SpaceIdPathOverride): Promise<ApiResponse<CreateResponses[201], ThrowOnError>> {
      const { body, signal, path, throwOnError } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<CreateResponses[201], ThrowOnError>(() =>
        presetsApi.create({ client, path: { space_id: resolvedSpaceId }, body, signal, ...(throwOnError === undefined ? {} : { throwOnError }) }), throwOnError);
    },
    update<ThrowOnError extends boolean = false>(
      presetId: number | string,
      options: { body: UpdateData['body']; signal?: AbortSignal; throwOnError?: ThrowOnError } & SpaceIdPathOverride,
    ): Promise<ApiResponse<UpdateResponses[200], ThrowOnError>> {
      const { body, signal, path, throwOnError } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<UpdateResponses[200], ThrowOnError>(() =>
        presetsApi.update({ client, path: { space_id: resolvedSpaceId, preset_id: presetId }, body, signal, ...(throwOnError === undefined ? {} : { throwOnError }) }), throwOnError);
    },
    remove<ThrowOnError extends boolean = false>(presetId: number | string, options: { signal?: AbortSignal; throwOnError?: ThrowOnError } & SpaceIdPathOverride = {}): Promise<ApiResponse<RemoveResponses[200], ThrowOnError>> {
      const { signal, path, throwOnError } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<RemoveResponses[200], ThrowOnError>(() =>
        presetsApi.remove({ client, path: { space_id: resolvedSpaceId, preset_id: presetId }, signal, ...(throwOnError === undefined ? {} : { throwOnError }) }), throwOnError);
    },
  };
}
