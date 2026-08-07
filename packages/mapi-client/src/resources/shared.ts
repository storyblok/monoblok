import type { Client } from '../generated/mapi/client';
import type { FetchOptions } from '../client';

export interface SpaceIdPathOverride {
  path?: {
    space_id?: number;
  };
}

/**
 * Assembles the optional fields shared by every wrapped SDK call: a
 * `throwOnError` override (forwarded only when explicitly set) and
 * `fetchOptions` merged into the client's configured `kyOptions`.
 */
export function buildCallOptions(
  client: Client,
  throwOnError: boolean | undefined,
  fetchOptions: FetchOptions | undefined,
): { throwOnError?: boolean; kyOptions?: Record<string, unknown> } {
  return {
    ...(throwOnError === undefined ? {} : { throwOnError }),
    ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}),
  };
}

export function resolveSpaceId(spaceId: number | undefined, path?: SpaceIdPathOverride['path']): number {
  const resolvedSpaceId = path?.space_id ?? spaceId;

  if (resolvedSpaceId === undefined) {
    throw new Error('Missing space_id. Provide `spaceId` when creating the client or pass `path.space_id` to the request method.');
  }

  return resolvedSpaceId;
}
