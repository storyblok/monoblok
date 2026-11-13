import type { Client } from "../generated/mapi/client";
import type { FetchOptions } from "../client";

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
