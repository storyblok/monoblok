import * as usersApi from '../generated/users/sdk.gen';
import type {
  MeResponses,
  UpdateMeData,
  UpdateMeResponses,
} from '../generated/users/types.gen';
import type { ApiResponse, MapiResourceDeps } from '../index';

export function createUsersResource(deps: Omit<MapiResourceDeps, 'spaceId'>) {
  const { client, wrapRequest } = deps;

  return {
    me<ThrowOnError extends boolean = false>(options: { signal?: AbortSignal; throwOnError?: ThrowOnError } = {}): Promise<ApiResponse<MeResponses[200], ThrowOnError>> {
      const { signal, throwOnError } = options;
      return wrapRequest<MeResponses[200], ThrowOnError>(() =>
        usersApi.me({ client, signal, ...(throwOnError === undefined ? {} : { throwOnError }) }), throwOnError);
    },
    updateMe<ThrowOnError extends boolean = false>(options: { body: UpdateMeData['body']; signal?: AbortSignal; throwOnError?: ThrowOnError }): Promise<ApiResponse<UpdateMeResponses[200], ThrowOnError>> {
      const { body, signal, throwOnError } = options;
      return wrapRequest<UpdateMeResponses[200], ThrowOnError>(() =>
        usersApi.updateMe({ client, body, signal, ...(throwOnError === undefined ? {} : { throwOnError }) }), throwOnError);
    },
  };
}
