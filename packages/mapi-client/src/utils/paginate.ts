import type { ApiResponse, MapiResourceDeps } from "../client";
import type { PaginationFailureReason } from "../error";
import { ClientError, PaginationError } from "../error";

/** The page size the API uses when the request sends no `per_page`. */
const DEFAULT_PER_PAGE = 25;

type PageEnvelope<TData, ThrowOnError extends boolean> = ThrowOnError extends true
  ? { data: TData; error?: never }
  : { data: TData; error?: undefined } | { data: undefined; error: PaginationError };

/**
 * One page of a `pages()` walk: the envelope `list()` returns for that page, plus where it
 * sits in the walk. Checking `error` narrows `data`.
 */
export type PageResult<TData, ThrowOnError extends boolean = false> = PageEnvelope<
  TData,
  ThrowOnError
> & {
  response: Response;
  request: Request;
  /** The page this response holds. */
  page: number;
  /** Items per page from the `Per-Page` header, else the requested `per_page`, else 25. */
  perPage: number;
  /** Total number of items across all pages, or `undefined` if the API didn't report it. */
  total: number | undefined;
};

/** The query parameters a walk reads. Generated query types are assignable to it. */
type WalkQuery = { page?: unknown; per_page?: unknown };

/** What a walk sends on top of the caller's query for each page. */
export type PageQuery = { page: number; per_page: number };

export type PaginateConfig<TData, TItem> = {
  query: WalkQuery | undefined;
  signal: AbortSignal | undefined;
  /** A failed request must resolve with `error` set, not reject. */
  fetchPage: (pageQuery: PageQuery, signal: AbortSignal | undefined) => Promise<ApiResponse<TData>>;
  /** Returns `undefined` when the response holds no list of items. */
  getItems: (data: TData) => TItem[] | undefined;
};

type WalkedPage<TData, TItem> = { result: PageResult<TData>; items: TItem[] };

const readPositiveInteger = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : undefined;
};

const readCountHeader = (response: Response, name: string): number | undefined => {
  const value = response.headers.get(name);
  if (value === null || value === "") {
    return undefined;
  }
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : undefined;
};

const isSuccessStatus = (status: number) => status >= 200 && status < 300;

const describeRequestError = (error: ClientError): string => {
  const { status, statusText } = error.response;
  if (status > 0) {
    return statusText ? `HTTP ${status} ${statusText}` : `HTTP ${status}`;
  }
  return error.cause instanceof Error ? error.cause.message : error.message;
};

/** Identifies a page by its first item, to notice an endpoint that ignores `page`. */
const fingerprintPage = (items: unknown[]): string | undefined => {
  try {
    return JSON.stringify(items[0]);
  } catch {
    return undefined;
  }
};

// Duplicated in the other API client; change both (ADR-0033).
async function* walkPages<TData, TItem>(
  config: PaginateConfig<TData, TItem>,
  throwOnFailure: boolean,
): AsyncGenerator<WalkedPage<TData, TItem>, void, undefined> {
  const { query = {}, signal, fetchPage, getItems } = config;
  // Sent explicitly: some endpoints ignore `page` unless `per_page` is set too.
  const requestedPerPage = readPositiveInteger(query.per_page) ?? DEFAULT_PER_PAGE;
  const firstPage = readPositiveInteger(query.page) ?? 1;
  let itemsThroughPage = 0;
  let previousFingerprint: string | undefined;

  const fail = (
    reason: PaginationFailureReason,
    message: string,
    options: { page: number; response: ClientError["response"]; cause?: unknown },
  ) =>
    new PaginationError(message, {
      reason,
      page: options.page,
      response: options.response,
      cause: options.cause,
    });

  const responseOf = ({ status, statusText }: Response): ClientError["response"] => ({
    status: status ?? 0,
    statusText: statusText ?? "",
    data: undefined,
  });

  const checkPage = (
    page: number,
    { data, error, response }: ApiResponse<TData>,
  ): { failure: PaginationError } | { data: TData; items: TItem[] } => {
    if (signal?.aborted) {
      return {
        failure: fail("request", `Page ${page} failed: the walk was aborted.`, {
          page,
          response: { status: 0, statusText: "", data: undefined },
          cause:
            error ??
            new ClientError("API request failed", {
              status: 0,
              statusText: "",
              data: undefined,
              cause: signal.reason,
            }),
        }),
      };
    }
    if (error !== undefined) {
      if (isSuccessStatus(error.response.status)) {
        return {
          failure: fail("invalid-response", `Page ${page} failed: the response isn't valid JSON.`, {
            page,
            response: responseOf(response),
            cause: error,
          }),
        };
      }
      return {
        failure: fail("request", `Page ${page} failed: ${describeRequestError(error)}`, {
          page,
          response: error.response,
          cause: error,
        }),
      };
    }

    let items: TItem[] | undefined;
    try {
      items = data === undefined ? undefined : getItems(data);
    } catch {
      items = undefined;
    }
    if (data === undefined || !Array.isArray(items)) {
      return {
        failure: fail("invalid-response", `Page ${page} failed: the response has no items.`, {
          page,
          response: responseOf(response),
        }),
      };
    }

    const fingerprint = items.length === 0 ? undefined : fingerprintPage(items);
    if (fingerprint !== undefined && fingerprint === previousFingerprint) {
      return {
        failure: fail(
          "invalid-response",
          `Page ${page} failed: it repeats page ${page - 1}; the endpoint may ignore \`page\`.`,
          { page, response: responseOf(response) },
        ),
      };
    }
    previousFingerprint = fingerprint;

    return { data, items };
  };

  for (let page = firstPage; ; page++) {
    const current = await fetchPage({ page, per_page: requestedPerPage }, signal);
    const perPage =
      readPositiveInteger(current.response.headers.get("per-page")) ?? requestedPerPage;
    const total = readCountHeader(current.response, "total");
    const meta = { page, perPage, total };

    const checked = checkPage(page, current);
    if ("failure" in checked) {
      if (throwOnFailure) {
        throw checked.failure;
      }
      yield {
        result: { ...current, ...meta, data: undefined, error: checked.failure },
        items: [],
      };
      return;
    }
    const { data, items } = checked;

    if (page === firstPage) {
      // Pages before the first one were read by an earlier walk.
      itemsThroughPage = (firstPage - 1) * perPage;
    }
    itemsThroughPage += items.length;

    yield { result: { ...current, ...meta, data, error: undefined }, items };

    // Counting received items rather than `page * perPage` keeps a page the API capped
    // below the requested `per_page` from ending the walk early.
    const isLastPage =
      items.length === 0 ||
      (total === undefined ? items.length < perPage : itemsThroughPage >= total);
    if (isLastPage) {
      return;
    }
  }
}

/**
 * Walks a paginated list page by page, yielding each page's envelope. A failed page is
 * the last value yielded, or is thrown as a `PaginationError` with `throwOnError`.
 */
export async function* paginatePages<TData, TItem, ThrowOnError extends boolean>(
  config: PaginateConfig<TData, TItem>,
  throwOnError: ThrowOnError | undefined,
  defaultThrowOnError: boolean,
): AsyncGenerator<PageResult<TData, ThrowOnError>, void, undefined> {
  const throwOnFailure = throwOnError ?? defaultThrowOnError;
  for await (const { result } of walkPages(config, throwOnFailure)) {
    // With `throwOnError`, a failed page throws instead of being yielded, and every other
    // page has `data`, as `PageResult<TData, true>` declares.
    yield result as PageResult<TData, ThrowOnError>;
  }
}

/** Walks a paginated list item by item. A failed page throws a `PaginationError`. */
export async function* paginateItems<TData, TItem>(
  config: PaginateConfig<TData, TItem>,
): AsyncGenerator<TItem, void, undefined> {
  try {
    for await (const { items } of walkPages(config, true)) {
      for (const item of items) {
        if (config.signal?.aborted) {
          throw config.signal.reason;
        }
        yield item;
      }
    }
  } catch (error) {
    // Aborting rejects with the abort reason, as `list()` does, so `AbortError` checks work.
    if (config.signal?.aborted && error instanceof PaginationError) {
      throw config.signal.reason;
    }
    throw error;
  }
}

type WalkOptions = { query?: WalkQuery; signal?: AbortSignal };

/** Builds a resource's `pages()` and `iterate()` on top of its `list()`. */
export const createPaginationMethods = <
  DefaultThrowOnError extends boolean,
  TOptions extends WalkOptions,
  TData,
  TItem,
>(
  deps: MapiResourceDeps<DefaultThrowOnError>,
  {
    fetchPage,
    getItems,
  }: {
    /**
     * Calls `list()` with `throwOnError: false`, merging `pageQuery` into the caller's query
     * and replacing the caller's `signal`.
     */
    fetchPage: (
      options: TOptions | undefined,
      pageQuery: PageQuery,
      signal: AbortSignal | undefined,
    ) => Promise<ApiResponse<TData>>;
    getItems: (data: TData) => TItem[] | undefined;
  },
) => {
  const toConfig = (options: TOptions | undefined): PaginateConfig<TData, TItem> => ({
    query: options?.query,
    signal: options?.signal,
    fetchPage: (pageQuery, signal) => fetchPage(options, pageQuery, signal),
    getItems,
  });

  return {
    /**
     * Walks every page, yielding one `list()` response per page. A failed page is the last
     * value yielded, so check `error` on each one. With `throwOnError`, it throws a
     * `PaginationError` instead.
     *
     * Pages are offsets into live data, so items created, deleted, or moved during the walk
     * can be skipped or yielded twice.
     */
    pages: <ThrowOnError extends boolean = DefaultThrowOnError>(
      options?: TOptions & { throwOnError?: ThrowOnError },
    ): AsyncGenerator<PageResult<TData, ThrowOnError>, void, undefined> =>
      paginatePages(
        toConfig(options),
        options?.throwOnError,
        deps.client.getConfig().throwOnError ?? false,
      ),

    /**
     * Walks every item across all pages, the replacement for `getAll()` in
     * `storyblok-js-client`. A failed page throws a `PaginationError`.
     *
     * Pages are offsets into live data, so items created, deleted, or moved during the walk
     * can be skipped or yielded twice.
     */
    iterate: (options?: TOptions): AsyncGenerator<TItem, void, undefined> =>
      paginateItems(toConfig(options)),
  };
};
