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
 * Structured error surfaced by the Content API client for a failed request.
 *
 * For an HTTP error response, it's thrown when `throwOnError: true` and otherwise
 * returned as `result.error`. A transport failure (no HTTP response at all — a timeout,
 * an abort, a DNS failure) is thrown as its original error instead when
 * `throwOnError: true`, so its identity survives; it's only wrapped here, with
 * `response.status` 0, when it resolves as `result.error`, to keep that field's type
 * accurate.
 */
export class ClientError extends Error {
  readonly response: { status: number; statusText: string; data: ApiErrorBody | undefined };
  /**
   * The underlying error, when this `ClientError` wraps one rather than an HTTP
   * response. Not set for ordinary HTTP error responses: their failure detail already
   * lives in `response.data`, and `error` there is the parsed body, not a cause.
   * `Error`'s own `cause` constructor option isn't available at this package's `lib`
   * target, so this is declared and assigned as a plain own field instead.
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

/**
 * Thrown by `iterate()`, and by `pages()` with `throwOnError: true`, when a page fails.
 * Carries what a new walk needs to resume where this one stopped:
 * `iterate({ query: { ...query, page: error.page, cv: error.cv } })`.
 */
export class PaginationError extends ClientError {
  /** The page that failed. */
  readonly page: number;
  /** The snapshot the walk was pinned to, if any. Resuming with it keeps offsets consistent. */
  readonly cv?: number;

  constructor(error: ClientError, options: { page: number; cv?: number }) {
    super(error.message, { ...error.response, cause: error.cause });
    this.name = "PaginationError";
    this.page = options.page;
    this.cv = options.cv;
  }
}
