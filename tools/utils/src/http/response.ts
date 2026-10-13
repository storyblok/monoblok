/**
 * Builds a placeholder `Request` for a call that never got far enough to produce one
 * — a malformed `baseUrl` fails here too, in which case a request pointing nowhere in
 * particular still beats losing `result.error`, which carries the original, more
 * useful message (including the full attempted request URL).
 */
function createFallbackRequest(baseUrl: string): Request {
  try {
    return new Request(baseUrl);
  } catch {
    return new Request("about:blank");
  }
}

/**
 * Guarantees a result's `response` and `request`. The generated client leaves
 * them `undefined` for a transport failure; callers see a synthetic
 * `Response.error()` and a request to `baseUrl` instead.
 */
export function withResponseFallbacks<TResult extends { response?: Response; request?: Request }>(
  result: TResult,
  baseUrl: string,
): TResult & { response: Response; request: Request } {
  return {
    ...result,
    response: result.response ?? Response.error(),
    request: result.request ?? createFallbackRequest(baseUrl),
  };
}
