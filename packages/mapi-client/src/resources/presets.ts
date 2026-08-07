import * as mapi from '../generated/mapi/sdk.gen';
import type {
  CreatePresetData,
  CreatePresetResponses,
  DeletePresetResponses,
  GetPresetResponses,
  ListPresetsData,
  ListPresetsResponses,
  UpdatePresetData,
  UpdatePresetResponses,
} from '../generated/mapi/types.gen';
import type { ApiResponse, FetchOptions, MapiResourceDeps } from '../client';
import { resolveSpaceId, type SpaceIdPathOverride } from './shared';

export function createPresetsResource<DefaultThrowOnError extends boolean = false>(deps: MapiResourceDeps<DefaultThrowOnError>) {
  const { client, spaceId, wrapRequest } = deps;
  const getSpaceId = (path?: SpaceIdPathOverride['path']) => resolveSpaceId(spaceId, path);

  return {
    list<ThrowOnError extends boolean = DefaultThrowOnError>(options: { query?: ListPresetsData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {}): Promise<ApiResponse<ListPresetsResponses[200], ThrowOnError>> {
      const { query, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<ListPresetsResponses[200], ThrowOnError>(() =>
        mapi.listPresets({ client, path: { space_id: resolvedSpaceId }, query, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    get<ThrowOnError extends boolean = DefaultThrowOnError>(presetId: number, options: { signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {}): Promise<ApiResponse<GetPresetResponses[200], ThrowOnError>> {
      const { signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<GetPresetResponses[200], ThrowOnError>(() =>
        mapi.getPreset({ client, path: { space_id: resolvedSpaceId, id: presetId }, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    create<ThrowOnError extends boolean = DefaultThrowOnError>(options: { body: CreatePresetData['body']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride): Promise<ApiResponse<CreatePresetResponses[201], ThrowOnError>> {
      const { body, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<CreatePresetResponses[201], ThrowOnError>(() =>
        mapi.createPreset({ client, path: { space_id: resolvedSpaceId }, body, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    update<ThrowOnError extends boolean = DefaultThrowOnError>(
      presetId: number,
      options: { body: UpdatePresetData['body']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride,
    ): Promise<ApiResponse<UpdatePresetResponses[200], ThrowOnError>> {
      const { body, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<UpdatePresetResponses[200], ThrowOnError>(() =>
        mapi.updatePreset({ client, path: { space_id: resolvedSpaceId, id: presetId }, body, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    delete<ThrowOnError extends boolean = DefaultThrowOnError>(presetId: number, options: { signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {}): Promise<ApiResponse<DeletePresetResponses[200], ThrowOnError>> {
      const { signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<DeletePresetResponses[200], ThrowOnError>(() =>
        mapi.deletePreset({ client, path: { space_id: resolvedSpaceId, id: presetId }, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
  };
}
