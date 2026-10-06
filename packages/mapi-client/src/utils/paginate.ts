import type { ApiResponse } from "../client";
import { ClientError, PaginationError } from "../error";

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
  /** Fetches one page. A failed request must resolve with `error` set, not reject. */
  fetchPage: (query: TQuery, signal: AbortSignal) => Promise<ApiResponse<TData>>;
  getItems: (data: TData) => TItem[];
};

const readPositiveInteger = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : undefined;
};

type PendingPage<TData> = {
  result: Promise<PageResult<TData>>;
  /** Aborts the request unless it already settled. */
  cancel: () => void;
};

const readCountHeader = (response: Response | undefined, name: string): number | undefined => {
  const value = response?.headers?.get?.(name);
  if (value === null || value === undefined || value === "") {
    return undefined;
  }
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : undefined;
};

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

async function* walkPages<TQuery extends Record<string, unknown>, TData, TItem>(
  config: PaginateConfig<TQuery, TData, TItem>,
  { prefetch, throwOnFailure }: { prefetch: boolean; throwOnFailure: boolean },
): AsyncGenerator<PageResult<TData>, void, undefined> {
  const { query, signal, fetchPage, getItems } = config;
  // Sent explicitly: some endpoints ignore `page` unless `per_page` is set too.
  const perPage = query.per_page ?? DEFAULT_PER_PAGE;
  const requestedPerPage = readPositiveInteger(perPage) ?? DEFAULT_PER_PAGE;

  const fetchAt = (page: number): PendingPage<TData> => {
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

    const result = fetchPage({ ...query, per_page: perPage, page }, controller.signal).then(
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
  let next = fetchAt(firstPage);

  try {
    for (let page = firstPage; ; page++) {
      const current = await next.result;

      if (signal?.aborted) {
        if (throwOnFailure) {
          throw signal.reason;
        }
        yield { ...current, data: undefined, error: abortError(signal.reason) };
        return;
      }

      if (current.error !== undefined || current.data === undefined) {
        const failure = new PaginationError(
          current.error ??
            new ClientError("API response has no data", {
              status: current.response?.status ?? 0,
              statusText: current.response?.statusText ?? "",
              data: undefined,
            }),
          { page },
        );
        if (throwOnFailure) {
          throw failure;
        }
        yield { ...current, data: undefined, error: failure };
        return;
      }

      const isLastPage = !hasNextPage(current, getItems(current.data).length);
      if (!isLastPage && prefetch) {
        next = fetchAt(page + 1);
      }

      yield current;

      if (isLastPage) {
        return;
      }
      if (!prefetch) {
        next = fetchAt(page + 1);
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
