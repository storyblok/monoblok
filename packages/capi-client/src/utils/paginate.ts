import type { ApiResponse } from "../client";
import { ClientError, PaginationError } from "../error";
import { extractCvFromUrl, extractServedCv, isCvPinned } from "./cv";
import { isDraftRequest } from "./request";

/** The page size the API uses when the request sends no `per_page`. */
const DEFAULT_PER_PAGE = 25;

/**
 * One page of a `pages()` walk: the envelope `list()` returns for that page, plus where it
 * sits in the walk.
 */
export type PageResult<TData, ThrowOnError extends boolean = false> = ApiResponse<
  TData,
  ThrowOnError
> & {
  /** The page this response holds. */
  page: number;
  /** Items per page from the `Per-Page` header, else the requested `per_page`, else 25. */
  perPage: number;
  /** Total number of items across all pages, or `undefined` if the API didn't report it. */
  total: number | undefined;
};

export type PaginateConfig<TQuery extends Record<string, unknown>, TData, TItem> = {
  query: TQuery;
  signal: AbortSignal | undefined;
  /** Pins published pages to the `cv` of the first page. Draft queries are never pinned. */
  pinCv: boolean;
  /** Fetches one page. A failed request must resolve with `error` set, not reject. */
  fetchPage: (query: TQuery, signal: AbortSignal) => Promise<ApiResponse<TData>>;
  getItems: (data: TData) => TItem[];
};

type PendingPage<TData> = {
  result: Promise<PageResult<TData>>;
  /** Aborts the request unless it already settled; a settled page may still revalidate. */
  cancel: () => void;
};

const readPositiveInteger = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : undefined;
};

const readCountHeader = (response: Response | undefined, name: string): number | undefined => {
  const value = response?.headers?.get?.(name);
  if (value === null || value === undefined || value === "") {
    return undefined;
  }
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : undefined;
};

const readServedCv = (result: {
  data?: unknown;
  response?: Response;
  request?: Request;
}): number | undefined => extractServedCv(result) ?? extractCvFromUrl(result.request?.url);

const hasNextPage = (
  { page, perPage, total }: { page: number; perPage: number; total: number | undefined },
  itemCount: number,
): boolean => {
  if (itemCount === 0) {
    return false;
  }
  return total === undefined ? itemCount >= perPage : page * perPage < total;
};

/** Mirrors the error `list()` resolves with for an aborted request. */
const abortError = (reason: unknown): ClientError =>
  new ClientError("API request failed", {
    status: 0,
    statusText: "",
    data: undefined,
    cause: reason,
  });

const responseError = (message: string, response: Response | undefined): ClientError =>
  new ClientError(message, {
    status: response?.status ?? 0,
    statusText: response?.statusText ?? "",
    data: undefined,
  });

async function* walkPages<TQuery extends Record<string, unknown>, TData, TItem>(
  config: PaginateConfig<TQuery, TData, TItem>,
  { prefetch, throwOnFailure }: { prefetch: boolean; throwOnFailure: boolean },
): AsyncGenerator<PageResult<TData>, void, undefined> {
  const { query, signal, pinCv, fetchPage, getItems } = config;
  // Sent explicitly: some endpoints ignore `page` unless `per_page` is set too.
  const perPage = query.per_page ?? DEFAULT_PER_PAGE;
  const requestedPerPage = readPositiveInteger(perPage) ?? DEFAULT_PER_PAGE;

  const fetchAt = (pageQuery: TQuery, page: number): PendingPage<TData> => {
    // One controller per page: aborting a finished page would also cancel its cache's
    // background revalidation.
    const controller = new AbortController();
    const abort = () => controller.abort(signal?.reason);
    if (signal?.aborted) {
      abort();
    } else {
      signal?.addEventListener("abort", abort, { once: true });
    }
    let isSettled = false;
    const settle = () => {
      isSettled = true;
      signal?.removeEventListener("abort", abort);
    };

    const result = fetchPage({ ...pageQuery, per_page: perPage, page }, controller.signal).then(
      (response) => ({
        ...response,
        page,
        perPage:
          readPositiveInteger(response.response?.headers?.get?.("per-page")) ?? requestedPerPage,
        total: readCountHeader(response.response, "total"),
      }),
    );
    result.then(settle, settle);
    // A prefetched page is awaited only once the walk reaches it, so its failure
    // surfaces in stream order rather than as an unhandled rejection.
    result.catch(() => undefined);

    return {
      result,
      cancel: () => {
        if (!isSettled) {
          controller.abort();
        }
        settle();
      },
    };
  };

  const firstPage = readPositiveInteger(query.page) ?? 1;
  let pageQuery = query;
  const isPinnable = pinCv && !isDraftRequest(query);
  const requestedCv = isPinnable && isCvPinned(query.cv) ? Number(query.cv) : undefined;
  let pinnedCv: number | undefined;
  let next = fetchAt(pageQuery, firstPage);

  const findPageFailure = ({
    data,
    error,
    page,
    response,
    request,
  }: PageResult<TData>): PaginationError | undefined => {
    if (error !== undefined) {
      return new PaginationError(error, { page, cv: pinnedCv });
    }
    if (data === undefined) {
      return new PaginationError(responseError("API response has no data", response), {
        page,
        cv: pinnedCv,
      });
    }
    const servedCv = readServedCv({ data, response, request });
    // A `cv` passed in by the caller resumes an earlier walk, whose offsets only hold in
    // that snapshot, so the first page must be served from it too.
    const expectedCv = page === firstPage ? requestedCv : pinnedCv;
    if (expectedCv !== undefined && servedCv !== undefined && servedCv !== expectedCv) {
      // The edge no longer holds the snapshot and served a newer one, whose offsets differ.
      const restartPage = requestedCv === undefined ? firstPage : 1;
      return new PaginationError(responseError("Snapshot changed", response), {
        page: restartPage,
        message:
          `Page ${page} failed: it was served from cv ${servedCv}, not cv ${expectedCv}, ` +
          `because content was published during the walk. ` +
          `Restart the walk from page ${restartPage}.`,
      });
    }
    return undefined;
  };

  try {
    for (let page = firstPage; ; page++) {
      const current = await next.result;

      // A page served from the cache never sees the signal, so check it here.
      if (signal?.aborted) {
        if (throwOnFailure) {
          throw signal.reason;
        }
        yield { ...current, data: undefined, error: abortError(signal.reason) };
        return;
      }

      const failure = findPageFailure(current);
      if (failure !== undefined) {
        if (throwOnFailure) {
          throw failure;
        }
        yield { ...current, data: undefined, error: failure };
        return;
      }

      if (page === firstPage && isPinnable) {
        // The served `cv`, not a requested one: the edge redirects a `cv` it doesn't hold.
        pinnedCv = readServedCv(current);
        pageQuery = pinnedCv === undefined ? pageQuery : { ...pageQuery, cv: pinnedCv };
      }

      const items = current.data === undefined ? [] : getItems(current.data);
      const isLastPage = !hasNextPage(current, items.length);
      if (!isLastPage && prefetch) {
        next = fetchAt(pageQuery, page + 1);
      }

      yield current;

      if (isLastPage) {
        return;
      }
      if (!prefetch) {
        next = fetchAt(pageQuery, page + 1);
      }
    }
  } finally {
    next.cancel();
  }
}

/**
 * Walks a paginated list page by page, yielding each page's envelope. A failed page is
 * the last value yielded, or is thrown as a `PaginationError` with `throwOnError`.
 */
export async function* paginatePages<
  TQuery extends Record<string, unknown>,
  TData,
  TItem,
  ThrowOnError extends boolean,
>(
  config: PaginateConfig<TQuery, TData, TItem>,
  throwOnError: ThrowOnError | undefined,
  defaultThrowOnError: boolean,
): AsyncGenerator<PageResult<TData, ThrowOnError>, void, undefined> {
  const throwOnFailure = throwOnError ?? defaultThrowOnError;
  for await (const result of walkPages(config, { prefetch: false, throwOnFailure })) {
    // With `throwOnError`, a failed page throws instead of being yielded, and every other
    // page has `data`, as `PageResult<TData, true>` declares.
    yield result as PageResult<TData, ThrowOnError>;
  }
}

/**
 * Walks a paginated list item by item, fetching the next page while the current one is
 * consumed. A failed page throws a `PaginationError`.
 */
export async function* paginateItems<TQuery extends Record<string, unknown>, TData, TItem>(
  config: PaginateConfig<TQuery, TData, TItem>,
): AsyncGenerator<TItem, void, undefined> {
  for await (const result of walkPages(config, { prefetch: true, throwOnFailure: true })) {
    if (result.data === undefined) {
      continue;
    }
    for (const item of config.getItems(result.data)) {
      if (config.signal?.aborted) {
        throw config.signal.reason;
      }
      yield item;
    }
  }
}
