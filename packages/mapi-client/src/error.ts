/**
 * Common shape of error bodies returned by the Storyblok Management API.
 *
 * Most error responses include an `error` field with a human-readable message.
 */
export interface ApiErrorBody {
  error?: string;
  message?: string;
  [key: string]: unknown;
}

/**
 * Structured error surfaced by the Management API client for a failed request.
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
 * Why a page of a pagination walk failed:
 * - `request`: the request failed. `response` and `cause` hold the HTTP or transport error.
 * - `invalid-response`: the API answered, but not with a page of items.
 */
export type PaginationFailureReason = "request" | "invalid-response";

/**
 * Thrown when a page fails: by `iterate()` always, and by `pages()` with `throwOnError` on the
 * call or the client. Unlike `list()`, transport failures (timeouts, network errors) are
 * wrapped too, with `response.status` 0 and the original error in `cause.cause`, so they keep
 * the resume point: `iterate({ query: { ...query, page: error.page } })`. Aborting the walk's
 * `signal` throws the abort reason instead.
 */
export class PaginationError extends ClientError {
  readonly reason: PaginationFailureReason;
  /** The page a new walk resumes from. */
  readonly page: number;

  constructor(
    message: string,
    options: {
      reason: PaginationFailureReason;
      page: number;
      response: ClientError["response"];
      cause?: unknown;
    },
  ) {
    super(message, { ...options.response, cause: options.cause });
    this.name = "PaginationError";
    this.reason = options.reason;
    this.page = options.page;
  }
}
