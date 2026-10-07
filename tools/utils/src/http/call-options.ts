/**
 * Assembles the optional fields shared by every wrapped SDK call: a
 * `throwOnError` override (forwarded only when explicitly set) and
 * `fetchOptions` merged into the client's configured `kyOptions`.
 */
export function buildCallOptions(
  client: { getConfig: () => { kyOptions?: object } },
  throwOnError: boolean | undefined,
  fetchOptions: Record<string, unknown> | undefined,
): { throwOnError?: boolean; kyOptions?: Record<string, unknown> } {
  return {
    ...(throwOnError === undefined ? {} : { throwOnError }),
    ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}),
  };
}
