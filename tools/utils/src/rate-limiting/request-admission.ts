import type { RateLimitContext, RateLimiter } from "./limiter";

/** Upper bound for any configured or server-reported requests-per-second rate. */
export const MAX_RATE_LIMIT = 1_000;

/** Builds the context a limiter is handed for a request's path and query. */
export type RateLimitContextResolver = (
  path: string,
  query: Record<string, unknown>,
) => RateLimitContext;

/**
 * Connects a `RateLimiter` to the HTTP layer: admits, observes and releases
 * every request that goes on the wire.
 */
export interface RequestAdmission {
  /**
   * Waits for the limiter to admit one request. Register it as a hook that runs
   * before the HTTP layer starts its timeout, so a queue longer than the
   * timeout delays requests instead of failing them.
   */
  beforeRequest: (request: Request) => Promise<void>;
  /**
   * Wraps `fetch` so the limiter observes and releases every HTTP request —
   * retries included — and admits the ones `beforeRequest` did not.
   */
  wrapFetch: (fetchFn: typeof globalThis.fetch) => typeof globalThis.fetch;
}

/** Query parameters that carry credentials and must not reach a limiter. */
const CREDENTIAL_PARAMS = new Set(["token"]);

function getRequestUrl(input: RequestInfo | URL): string | undefined {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.href;
  }
  return typeof input === "object" && input !== null && "url" in input ? input.url : undefined;
}

/**
 * Splits an outgoing request URL into the path and query a limiter is given.
 *
 * Derived from the URL rather than carried alongside the call so that it stays
 * correct when several requests are in flight at once.
 */
function requestParts(url: string | undefined): { path: string; query: Record<string, unknown> } {
  if (url === undefined) {
    return { path: "", query: {} };
  }

  try {
    const parsed = new URL(url);
    const query: Record<string, unknown> = {};
    for (const [key, value] of parsed.searchParams) {
      if (!CREDENTIAL_PARAMS.has(key)) {
        query[key] = value;
      }
    }
    return { path: parsed.pathname, query };
  } catch {
    // A URL that will not parse must still not hand a token to a custom
    // limiter, so the query is dropped rather than passed through unread.
    return { path: url.split("?")[0] ?? url, query: {} };
  }
}

/**
 * Swallows a reporting hook's failure. Shared storage can fail transiently, and
 * neither recording a response nor releasing a slot may turn a served request
 * into an error, or, inside the retry loop, into another request.
 */
async function report(hook: () => void | Promise<void>): Promise<void> {
  try {
    await hook();
  } catch {
    // Intentionally ignored.
  }
}

export function createRequestAdmission(
  limiter: RateLimiter,
  toContext: RateLimitContextResolver,
): RequestAdmission {
  // Each attempt is admitted separately, because the HTTP layer retries inside
  // one call: gating the call alone would let one admitted request put
  // `retry.limit + 1` requests on the wire during a 429 storm. The request
  // carries its context from admission to response so that a limiter pairing a
  // release to its acquire by identity finds the one it admitted.
  const admitted = new WeakMap<Request, RateLimitContext>();

  const admit = async (url: string | undefined): Promise<RateLimitContext> => {
    const { path, query } = requestParts(url);
    const context = toContext(path, query);
    await limiter.acquire(context);
    return context;
  };

  return {
    beforeRequest: async (request) => {
      admitted.set(request, await admit(request.url));
    },
    wrapFetch: (fetchFn) => async (input, init) => {
      // Queueing here would count against the request timeout, so admission
      // belongs in `beforeRequest`. Waiting for it here regardless keeps a
      // caller that only wraps `fetch` paced rather than unthrottled.
      const context =
        (input instanceof Request ? admitted.get(input) : undefined) ??
        (await admit(getRequestUrl(input)));

      try {
        const response = await fetchFn(input, init);
        // The limiter gets a copy: reading the body of the response the caller
        // is waiting for would consume it.
        await report(() => limiter.recordResponse?.(context, response.clone()));
        return response;
      } finally {
        await report(() => limiter.release?.(context));
      }
    },
  };
}
