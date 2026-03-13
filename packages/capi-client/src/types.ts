import type { Client, RequestOptions } from './generated/shared/client';
import type { ClientError } from './error';
import type { ThrottleManager } from './utils/rate-limit';

export type ApiResponse<Data = unknown, ThrowOnError extends boolean = false> =
  ThrowOnError extends true
    ? { data: Data; response: Response; request: Request }
    : { data?: Data; error?: ClientError; response: Response; request: Request };

export type HttpRequestOptions = Omit<
  RequestOptions,
  'method' | 'security' | 'url'
>;

export type HttpRequestMethod = <TData = unknown>(
  path: string,
  options?: HttpRequestOptions,
) => Promise<ApiResponse<TData>>;

/**
 * Arbitrary options forwarded to the underlying `fetch()` call.
 *
 * Standard `RequestInit` properties (`cache`, `credentials`, `mode`, …) and
 * non-standard, vendor-specific properties (Next.js `next`, Cloudflare `cf`, …)
 * are both supported.
 *
 * @example
 * ```ts
 * client.stories.get('home', {
 *   fetchOptions: {
 *     cache: 'no-store',
 *     next: { revalidate: 60, tags: ['home'] },
 *   },
 * })
 * ```
 */
export type FetchOptions = Record<string, unknown>;

export interface RequestWithCacheOptions {
  /** Prefix added to the cache key to namespace entries (e.g. `'inline'`). */
  cacheKeyPrefix?: string;
}

export interface ResourceDeps {
  client: Client;
  requestWithCache: <TData, ThrowOnError extends boolean = false>(
    method: 'GET',
    path: string,
    rawQuery: Record<string, unknown>,
    fetchFn: (query: Record<string, unknown>) => Promise<ApiResponse<TData, ThrowOnError>>,
    options?: RequestWithCacheOptions,
  ) => Promise<ApiResponse<TData, ThrowOnError>>;
  asApiResponse: <TData, ThrowOnError extends boolean = false>(p: Promise<unknown>) => Promise<ApiResponse<TData, ThrowOnError>>;
  throttleManager: ThrottleManager;
}
