import type { Client, RequestOptions } from './generated/shared/client';
import type { ClientError } from './error';

export type ApiResponse<T, ThrowOnError extends boolean = false> =
  ThrowOnError extends true
    ? { data: T; response: Response; request: Request }
    : | { data: T; error: undefined; response: Response; request: Request }
      | { data: undefined; error: ClientError; response: Response; request: Request };

export type HttpRequestOptions = Omit<
  RequestOptions<unknown, 'fields', boolean>,
  'method' | 'security' | 'url'
>;

export type RequestConfigOverrides = Pick<HttpRequestOptions, 'throwOnError'>;

export type HttpRequestMethod = <TData = unknown>(
  path: string,
  options?: HttpRequestOptions,
) => Promise<ApiResponse<TData>>;

export interface ResourceDeps {
  client: Client;
  requestWithCache: <TData, ThrowOnError extends boolean = false>(
    method: 'GET',
    path: string,
    rawQuery: Record<string, unknown>,
    fetchFn: (query: Record<string, unknown>) => Promise<ApiResponse<TData, ThrowOnError>>,
  ) => Promise<ApiResponse<TData, ThrowOnError>>;
  asApiResponse: <TData, ThrowOnError extends boolean = false>(p: Promise<unknown>) => Promise<ApiResponse<TData, ThrowOnError>>;
}
