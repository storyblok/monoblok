import * as usersApi from '../generated/users/sdk.gen';
import type {
  MeResponses,
  UpdateMeData,
  UpdateMeResponses,
} from '../generated/users/types.gen';
import type { ApiResponse, FetchOptions, MapiResourceDeps } from '../client';

export function createUsersResource<DefaultThrowOnError extends boolean = false>(deps: Omit<MapiResourceDeps<DefaultThrowOnError>, 'spaceId'>) {
  const { client, wrapRequest } = deps;

  return {
    me<ThrowOnError extends boolean = DefaultThrowOnError>(options: { signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } = {}): Promise<ApiResponse<MeResponses[200], ThrowOnError>> {
      const { signal, throwOnError, fetchOptions } = options;
      return wrapRequest<MeResponses[200], ThrowOnError>(() =>
        usersApi.me({ client, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    updateMe<ThrowOnError extends boolean = DefaultThrowOnError>(options: { body: UpdateMeData['body']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions }): Promise<ApiResponse<UpdateMeResponses[200], ThrowOnError>> {
      const { body, signal, throwOnError, fetchOptions } = options;
      return wrapRequest<UpdateMeResponses[200], ThrowOnError>(() =>
        usersApi.updateMe({ client, body, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
  };
}
