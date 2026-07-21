import * as mapi from '../generated/mapi/sdk.gen';
import type {
  GetCurrentUserResponses,
  UpdateCurrentUserData,
  UpdateCurrentUserResponses,
} from '../generated/mapi/types.gen';
import type { ApiResponse, FetchOptions, MapiResourceDeps } from '../client';

export function createUsersResource<DefaultThrowOnError extends boolean = false>(deps: Omit<MapiResourceDeps<DefaultThrowOnError>, 'spaceId'>) {
  const { client, wrapRequest } = deps;

  return {
    me<ThrowOnError extends boolean = DefaultThrowOnError>(options: { signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } = {}): Promise<ApiResponse<GetCurrentUserResponses[200], ThrowOnError>> {
      const { signal, throwOnError, fetchOptions } = options;
      return wrapRequest<GetCurrentUserResponses[200], ThrowOnError>(() =>
        mapi.getCurrentUser({ client, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    updateMe<ThrowOnError extends boolean = DefaultThrowOnError>(options: { body: UpdateCurrentUserData['body']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions }): Promise<ApiResponse<UpdateCurrentUserResponses[200], ThrowOnError>> {
      const { body, signal, throwOnError, fetchOptions } = options;
      return wrapRequest<UpdateCurrentUserResponses[200], ThrowOnError>(() =>
        mapi.updateCurrentUser({ client, body, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
  };
}
