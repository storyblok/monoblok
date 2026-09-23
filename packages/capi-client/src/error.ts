/**
 * Common shape of error bodies returned by the Storyblok Content Delivery API.
 *
 * Most error responses include an `error` or `message` field with a
 * human-readable description.
 */
export interface ApiErrorBody {
  error?: string;
  message?: string;
  [key: string]: unknown;
}

/**
 * Structured HTTP error thrown by the Content API client when `throwOnError: true`.
 */
export class ClientError extends Error {
  readonly response: { status: number; statusText: string; data: ApiErrorBody | undefined };
  /**
   * The error the interceptor caught before wrapping it — an `AbortError`, a network
   * failure, etc. `Error`'s own `cause` constructor option isn't available at this
   * package's `lib` target, so this is declared and assigned as a plain own field
   * instead.
   */
  readonly cause?: unknown;

  constructor(
    message: string,
    options: { status: number; statusText: string; data: unknown; cause?: unknown },
  ) {
    super(message);
    this.name = "ClientError";
    this.cause = options.cause;
    this.response = {
      status: options.status,
      statusText: options.statusText,
      data: options.data as ApiErrorBody | undefined,
    };
  }
}
