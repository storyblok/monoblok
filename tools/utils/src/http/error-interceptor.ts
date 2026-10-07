import { ClientError } from "../errors/client-error";

/**
 * Creates the generated client's error interceptor, which turns every failed
 * request into a `ClientError`, except a transport failure the caller asked to
 * have thrown.
 */
export function createErrorInterceptor(
  defaultThrowOnError: boolean,
): (
  error: unknown,
  response: Response | undefined,
  request: Request | undefined,
  options: { throwOnError?: boolean },
) => unknown {
  return (error, response, _request, options) => {
    if (!response) {
      // A transport failure only ever reaches the interceptor through the generated
      // client's outer catch, which — unlike the HTTP-error path below — passes the
      // options as given to this call, not merged with the client-level default. A
      // call that relies on that default rather than overriding `throwOnError` itself
      // would otherwise read as `undefined` here regardless of the effective value.
      if (options.throwOnError ?? defaultThrowOnError) {
        // No HTTP answer at all — a timeout, an abort, a DNS failure. This rejects as-is
        // rather than being wrapped, so its name, message, and `instanceof` checks (e.g.
        // `AbortError`) survive.
        return error;
      }

      // Without `throwOnError` this resolves as `result.error`, which `ApiResponse`
      // types as `ClientError`. Wrap it here to keep that contract accurate — unlike the
      // rejection path, callers can't narrow a resolved value by `instanceof` before
      // touching it, so it has to already be the declared shape. The original error
      // stays reachable via `cause`.
      return new ClientError("API request failed", {
        status: 0,
        statusText: "",
        data: undefined,
        cause: error,
      });
    }

    return new ClientError(response.statusText || "API request failed", {
      status: response.status,
      statusText: response.statusText,
      data: error,
    });
  };
}
