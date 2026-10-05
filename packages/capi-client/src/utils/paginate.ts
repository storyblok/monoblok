import type { ApiResponse } from "../client";
import { PaginationError } from "../error";
import { applyCvToQuery, extractCv, isCvPinned } from "./cv";

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
  /** Items per page, as reported by the API. */
  perPage: number;
  /** Total number of items across all pages, or `undefined` if the API didn't report it. */
  total: number | undefined;
};

export type PaginateConfig<TQuery extends Record<string, unknown>, TData, TItem> = {
  query: TQuery;
  signal: AbortSignal | undefined;
  /** Pins the walk to the `cv` of its first page, unless disabled by `cache.cv: 'manual'`. */
  pinCv: boolean;
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

async function* walkPages<TQuery extends Record<string, unknown>, TData, TItem>(
  config: PaginateConfig<TQuery, TData, TItem>,
  { prefetch, throwOnFailure }: { prefetch: boolean; throwOnFailure: boolean },
): AsyncGenerator<PageResult<TData>, void, undefined> {
  const { query, signal, pinCv, fetchPage, getItems } = config;
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  if (signal?.aborted) {
    abort();
  } else {
    signal?.addEventListener("abort", abort, { once: true });
  }

  const fetchAt = (pageQuery: TQuery, page: number): Promise<PageResult<TData>> => {
    const pending = fetchPage({ ...pageQuery, page }, controller.signal).then((result) => ({
      ...result,
      page,
      perPage:
        readCountHeader(result.response, "per-page") ??
        readPositiveInteger(query.per_page) ??
        DEFAULT_PER_PAGE,
      total: readCountHeader(result.response, "total"),
    }));
    // A prefetched page is awaited only once the walk reaches it, so its failure
    // surfaces in stream order rather than as an unhandled rejection.
    pending.catch(() => undefined);
    return pending;
  };

  try {
    const firstPage = readPositiveInteger(query.page) ?? 1;
    let pageQuery = query;
    let next = fetchAt(pageQuery, firstPage);

    for (let page = firstPage; ; page++) {
      const current = await next;

      if (current.error !== undefined || current.data === undefined) {
        if (throwOnFailure && current.error !== undefined) {
          const cv = isCvPinned(pageQuery.cv) ? Number(pageQuery.cv) : undefined;
          throw new PaginationError(current.error, { page, cv });
        }
        yield current;
        return;
      }

      if (page === firstPage && pinCv) {
        const cv = extractCv(current.data);
        pageQuery = cv === undefined ? pageQuery : applyCvToQuery(pageQuery, cv);
      }

      const isLastPage = !hasNextPage(current, getItems(current.data).length);
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
    signal?.removeEventListener("abort", abort);
    controller.abort();
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
    // With `throwOnError`, a failed page throws before it is yielded, so every yielded
    // page has `data` as `PageResult<TData, true>` promises.
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
    if (result.data !== undefined) {
      yield* config.getItems(result.data);
    }
  }
}
