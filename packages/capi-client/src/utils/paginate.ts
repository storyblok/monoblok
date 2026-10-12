import type { ApiResponse, ResourceDeps } from "../client";
import type { PaginationFailureReason } from "../error";
import { ClientError, PaginationError } from "../error";
import { extractServedCv, isCvPinned } from "./cv";
import { isDraftRequest } from "./request";

/** The page size the API uses when the request sends no `per_page`. */
const DEFAULT_PER_PAGE = 25;

type PageEnvelope<TData, ThrowOnError extends boolean> = ThrowOnError extends true
  ? { data: TData; error?: never }
  : { data: TData; error?: undefined } | { data: undefined; error: ClientError };

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
type WalkQuery = { page?: unknown; per_page?: unknown; cv?: unknown; version?: unknown };

/** What a walk sends on top of the caller's query for each page. */
export type PageQuery = { page: number; per_page: number; cv?: number };

export type PaginateConfig<TData, TItem> = {
  query: WalkQuery | undefined;
  signal: AbortSignal | undefined;
  /** Pins published pages to the `cv` of the first page. Draft queries are never pinned. */
  pinCv: boolean;
  /** Fetches one page. A failed request must resolve with `error` set, not reject. */
  fetchPage: (pageQuery: PageQuery, signal: AbortSignal) => Promise<ApiResponse<TData>>;
  /** Returns `undefined` when the response holds no list of items. */
  getItems: (data: TData) => TItem[] | undefined;
};

type WalkedPage<TData, TItem> = { result: PageResult<TData>; items: TItem[] };

type PendingPage<TData> = {
  result: Promise<ApiResponse<TData>>;
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

/** Mirrors the error `list()` resolves with for an aborted request. */
const abortError = (reason: unknown): ClientError =>
  new ClientError("API request failed", {
    status: 0,
    statusText: "",
    data: undefined,
    cause: reason,
  });

const isSuccessStatus = (status: number) => status >= 200 && status < 300;

/** Identifies a page by its first item, to notice an endpoint that ignores `page`. */
const fingerprintPage = (items: unknown[]): string | undefined => {
  try {
    return JSON.stringify(items[0]);
  } catch {
    return undefined;
  }
};

// Duplicated in the other API client; change both (ADR-0020).
async function* walkPages<TData, TItem>(
  config: PaginateConfig<TData, TItem>,
  { prefetch, throwOnFailure }: { prefetch: boolean; throwOnFailure: boolean },
): AsyncGenerator<WalkedPage<TData, TItem>, void, undefined> {
  const { query = {}, signal, pinCv, fetchPage, getItems } = config;
  // Sent explicitly: some endpoints ignore `page` unless `per_page` is set too.
  const requestedPerPage = readPositiveInteger(query.per_page) ?? DEFAULT_PER_PAGE;

  const fetchAt = (page: number, cv: number | undefined): PendingPage<TData> => {
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

    const pageQuery: PageQuery =
      cv === undefined
        ? { page, per_page: requestedPerPage }
        : { page, per_page: requestedPerPage, cv };
    const result = fetchPage(pageQuery, controller.signal);
    result.then(settle, settle);
    // A prefetched page is awaited only once the walk reaches it, so its failure
    // surfaces in stream order rather than as an unhandled rejection.
    result.catch(() => undefined);

    return {
      result,
      cancel: () => {
        // A cache hit settles a few microtasks after it starts, but keeps revalidating on
        // this signal, so it gets a macrotask to settle before the abort.
        setTimeout(() => {
          if (!isSettled) {
            controller.abort();
          }
          settle();
        }, 0);
      },
    };
  };

  const firstPage = readPositiveInteger(query.page) ?? 1;
  const isPinnable = pinCv && !isDraftRequest(query);
  const requestedCv = isPinnable && isCvPinned(query.cv) ? Number(query.cv) : undefined;
  // Offsets past page 1 only hold in the snapshot the earlier walk read. A walk from page 1
  // just pins whatever `cv` the API serves, so a stale or made-up `cv` doesn't fail it.
  const resumedCv = firstPage > 1 ? requestedCv : undefined;
  let pinnedCv: number | undefined;
  let itemsThroughPage = 0;
  let previousFingerprint: string | undefined;
  let next = fetchAt(firstPage, undefined);

  const fail = (
    reason: PaginationFailureReason,
    message: string,
    options: { page: number; cv?: number; response: Response | undefined; cause?: unknown },
  ) =>
    new PaginationError(message, {
      reason,
      page: options.page,
      cv: options.cv,
      response: {
        status: options.response?.status ?? 0,
        statusText: options.response?.statusText ?? "",
        data: undefined,
      },
      cause: options.cause,
    });

  const checkPage = (
    page: number,
    { data, error, response }: ApiResponse<TData>,
  ): { failure: PaginationError } | { data: TData; items: TItem[] } => {
    const cv = pinnedCv ?? requestedCv;
    if (error !== undefined) {
      if (isSuccessStatus(error.response.status)) {
        return {
          failure: fail("invalid-response", `Page ${page} failed: the response isn't valid JSON.`, {
            page,
            cv,
            response,
            cause: error,
          }),
        };
      }
      return {
        failure: new PaginationError(`Page ${page} failed: ${error.message}`, {
          reason: "request",
          page,
          cv,
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
          cv,
          response,
        }),
      };
    }

    const servedCv = extractServedCv({ data, response });
    const expectedCv = page === firstPage ? resumedCv : pinnedCv;
    if (expectedCv !== undefined && servedCv !== undefined && servedCv !== expectedCv) {
      const restartPage = resumedCv === undefined ? firstPage : 1;
      return {
        failure: fail(
          "snapshot-changed",
          `Page ${page} failed: it was served from cv ${servedCv}, not cv ${expectedCv}, ` +
            `because content changed after the walk started. ` +
            `Restart the walk from page ${restartPage}.`,
          { page: restartPage, response },
        ),
      };
    }

    const fingerprint = items.length === 0 ? undefined : fingerprintPage(items);
    if (fingerprint !== undefined && fingerprint === previousFingerprint) {
      return {
        failure: fail(
          "invalid-response",
          `Page ${page} failed: it repeats page ${page - 1}, so the endpoint ignores \`page\`.`,
          { page, cv, response },
        ),
      };
    }
    previousFingerprint = fingerprint;

    return { data, items };
  };

  try {
    for (let page = firstPage; ; page++) {
      const current = await next.result;
      const perPage =
        readPositiveInteger(current.response?.headers?.get?.("per-page")) ?? requestedPerPage;
      const total = readCountHeader(current.response, "total");
      const meta = { page, perPage, total };

      // A page served from the cache never sees the signal, so check it here.
      if (signal?.aborted) {
        if (throwOnFailure) {
          throw signal.reason;
        }
        yield {
          result: { ...current, ...meta, data: undefined, error: abortError(signal.reason) },
          items: [],
        };
        return;
      }

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
        // The served `cv`, not a requested one: the API redirects a `cv` it doesn't serve.
        pinnedCv = isPinnable ? extractServedCv(current) : undefined;
        // Pages before the first one were read by an earlier walk.
        itemsThroughPage = (firstPage - 1) * perPage;
      }
      itemsThroughPage += items.length;

      // Counting received items rather than `page * perPage` keeps a page the API capped
      // below the requested `per_page` from ending the walk early.
      const isLastPage =
        items.length === 0 ||
        (total === undefined ? items.length < perPage : itemsThroughPage >= total);
      if (!isLastPage && prefetch) {
        next = fetchAt(page + 1, pinnedCv);
      }

      yield { result: { ...current, ...meta, data, error: undefined }, items };

      if (isLastPage) {
        return;
      }
      if (!prefetch) {
        next = fetchAt(page + 1, pinnedCv);
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
export async function* paginatePages<TData, TItem, ThrowOnError extends boolean>(
  config: PaginateConfig<TData, TItem>,
  throwOnError: ThrowOnError | undefined,
  defaultThrowOnError: boolean,
): AsyncGenerator<PageResult<TData, ThrowOnError>, void, undefined> {
  const throwOnFailure = throwOnError ?? defaultThrowOnError;
  for await (const { result } of walkPages(config, { prefetch: false, throwOnFailure })) {
    // With `throwOnError`, a failed page throws instead of being yielded, and every other
    // page has `data`, as `PageResult<TData, true>` declares.
    yield result as PageResult<TData, ThrowOnError>;
  }
}

/**
 * Walks a paginated list item by item, fetching the next page while the current one is
 * consumed. A failed page throws a `PaginationError`.
 */
export async function* paginateItems<TData, TItem>(
  config: PaginateConfig<TData, TItem>,
): AsyncGenerator<TItem, void, undefined> {
  for await (const { items } of walkPages(config, { prefetch: true, throwOnFailure: true })) {
    for (const item of items) {
      if (config.signal?.aborted) {
        throw config.signal.reason;
      }
      yield item;
    }
  }
}

type WalkOptions = { query?: WalkQuery; signal?: AbortSignal };

/**
 * Builds a resource's `pages()` and `iterate()` on top of its `list()`. Both take the
 * options `list()` takes; `iterate()` takes no `throwOnError`.
 */
export const createPaginationMethods = <
  DefaultThrowOnError extends boolean,
  TOptions extends WalkOptions,
  TData,
  TItem,
>(
  deps: ResourceDeps<DefaultThrowOnError>,
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
      signal: AbortSignal,
    ) => Promise<ApiResponse<TData>>;
    getItems: (data: TData) => TItem[] | undefined;
  },
) => {
  const toConfig = (options: TOptions | undefined): PaginateConfig<TData, TItem> => ({
    query: options?.query,
    signal: options?.signal,
    pinCv: deps.cvMode !== "manual",
    fetchPage: (pageQuery, signal) => fetchPage(options, pageQuery, signal),
    getItems,
  });

  return {
    pages: <ThrowOnError extends boolean = DefaultThrowOnError>(
      options?: TOptions & { throwOnError?: ThrowOnError },
    ): AsyncGenerator<PageResult<TData, ThrowOnError>, void, undefined> =>
      paginatePages(
        toConfig(options),
        options?.throwOnError,
        deps.client.getConfig().throwOnError ?? false,
      ),
    iterate: (options?: TOptions): AsyncGenerator<TItem, void, undefined> =>
      paginateItems(toConfig(options)),
  };
};
