import type { ApiResponse, ResourceDeps } from "../client";
import type { PaginationFailureReason } from "../error";
import { ClientError, PaginationError } from "../error";
import { extractServedCv, isCvPinned } from "./cv";
import { isDraftRequest } from "./request";

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
type WalkQuery = { page?: unknown; per_page?: unknown; cv?: unknown; version?: unknown };

/** What a walk sends on top of the caller's query for each page. */
export type PageQuery = { page: number; per_page: number; cv?: number };

export type PaginateConfig<TData, TItem> = {
  /** The list endpoint, e.g. `/v2/cdn/links`. */
  path: string;
  query: WalkQuery | undefined;
  signal: AbortSignal | undefined;
  /** Pins published pages to the `cv` of the first page. Draft queries are never pinned. */
  pinCv: boolean;
  /**
   * A failed request resolves with `error` set. A rejection fails the page like a transport
   * failure.
   */
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

/** A cache provider that serializes entries returns a plain object instead of a `Response`. */
const readHeader = (response: Response, name: string): string | null | undefined =>
  response.headers?.get?.(name);

const readCountHeader = (response: Response, name: string): number | undefined => {
  const value = readHeader(response, name);
  if (value === null || value === undefined || value === "") {
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

/**
 * Identifies a page by its first and last items, to notice an endpoint that ignores `page`.
 * Serializing whole pages would cost too much for large stories.
 */
const fingerprintPage = (items: unknown[]): string | undefined => {
  try {
    return JSON.stringify([items[0], items[items.length - 1]]);
  } catch {
    return undefined;
  }
};

/** Shapes a rejected page request like a transport failure, which `list()` resolves with. */
const toFailedResponse = <TData>(error: unknown): ApiResponse<TData> => ({
  data: undefined,
  error: new ClientError("API request failed", {
    status: 0,
    statusText: "",
    data: undefined,
    cause: error,
  }),
  response: Response.error(),
  request: new Request("about:blank"),
});

// Duplicated in the other API client; change both (ADR-0033).
async function* walkPages<TData, TItem>(
  config: PaginateConfig<TData, TItem>,
  throwOnFailure: boolean,
): AsyncGenerator<WalkedPage<TData, TItem>, void, undefined> {
  const { path, query = {}, signal, pinCv, fetchPage, getItems } = config;
  // Sent explicitly: some endpoints ignore `page` unless `per_page` is set too.
  const requestedPerPage = readPositiveInteger(query.per_page) ?? DEFAULT_PER_PAGE;
  const firstPage = readPositiveInteger(query.page) ?? 1;
  const isPinnable = pinCv && !isDraftRequest(query);
  const callerCv = isCvPinned(query.cv) ? Number(query.cv) : undefined;
  // Offsets past page 1 only hold in the snapshot the earlier walk read. A walk from page 1
  // pins whatever `cv` the API serves, so a stale or made-up `cv` doesn't fail it.
  const resumedCv = isPinnable && firstPage > 1 ? callerCv : undefined;
  let pinnedCv: number | undefined;
  let itemsThroughPage = 0;
  let previousFingerprint: string | undefined;

  const fail = (
    reason: PaginationFailureReason,
    message: string,
    options: {
      page: number;
      resumePage?: number;
      cv?: number;
      response: ClientError["response"];
      cause?: unknown;
    },
  ) =>
    new PaginationError(message, {
      reason,
      page: options.page,
      resumePage: options.resumePage ?? options.page,
      cv: options.cv,
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
    const cv = pinnedCv ?? callerCv;
    if (signal?.aborted) {
      return {
        failure: fail("request", `Page ${page} failed: the walk was aborted.`, {
          page,
          cv,
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
            cv,
            response: responseOf(response),
            cause: error,
          }),
        };
      }
      return {
        failure: fail("request", `Page ${page} failed: ${describeRequestError(error)}`, {
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
          response: responseOf(response),
        }),
      };
    }

    const servedCv = extractServedCv({ data, response }, { method: "GET", path, query });
    const expectedCv = page === firstPage ? resumedCv : pinnedCv;
    if (expectedCv !== undefined && servedCv !== undefined && servedCv !== expectedCv) {
      // Pages before a resumed walk's first one came from the old snapshot too.
      const resumePage = resumedCv === undefined ? firstPage : 1;
      return {
        failure: fail(
          "snapshot-changed",
          `Page ${page} failed: content changed since cv ${expectedCv} (now cv ${servedCv}). ` +
            `Restart from page ${resumePage} (with \`cache.flush: 'manual'\`, call ` +
            `\`flushCache()\` first).`,
          { page, resumePage, response: responseOf(response) },
        ),
      };
    }

    const fingerprint = items.length === 0 ? undefined : fingerprintPage(items);
    if (fingerprint !== undefined && fingerprint === previousFingerprint) {
      return {
        failure: fail(
          "invalid-response",
          `Page ${page} failed: it repeats page ${page - 1}; the endpoint may ignore \`page\`.`,
          { page, cv, response: responseOf(response) },
        ),
      };
    }
    previousFingerprint = fingerprint;

    return { data, items };
  };

  for (let page = firstPage; ; page++) {
    const pageQuery: PageQuery =
      pinnedCv === undefined
        ? { page, per_page: requestedPerPage }
        : { page, per_page: requestedPerPage, cv: pinnedCv };
    let current: ApiResponse<TData>;
    try {
      current = await fetchPage(pageQuery, signal);
    } catch (error) {
      current = toFailedResponse(error);
    }
    const perPage =
      readPositiveInteger(readHeader(current.response, "per-page")) ?? requestedPerPage;
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
      // The served `cv`, not a requested one: the API redirects a `cv` it doesn't serve.
      pinnedCv = isPinnable ? extractServedCv(current, { method: "GET", path, query }) : undefined;
      // Pages before the first one were read by an earlier walk.
      itemsThroughPage = (firstPage - 1) * perPage;
    }
    itemsThroughPage += items.length;

    // Decided before yielding: the caller may mutate the page's items.
    // Counting received items rather than `page * perPage` keeps a page the API capped
    // below the requested `per_page` from ending the walk early.
    const isLastPage =
      items.length === 0 ||
      (total === undefined ? items.length < perPage : itemsThroughPage >= total);

    yield { result: { ...current, ...meta, data, error: undefined }, items };

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
  deps: ResourceDeps<DefaultThrowOnError>,
  {
    path,
    fetchPage,
    getItems,
  }: {
    path: string;
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
    path,
    query: options?.query,
    signal: options?.signal,
    pinCv: deps.cvMode !== "manual",
    fetchPage: (pageQuery, signal) => fetchPage(options, pageQuery, signal),
    getItems,
  });

  return {
    /**
     * Walks every page, yielding one `list()` response per page. A failed page is the last
     * value yielded, so check `error` on each one. With `throwOnError`, it throws a
     * `PaginationError` instead.
     *
     * Published walks fail with a `snapshot-changed` `PaginationError` when content is
     * published mid-walk: later pages are pinned to the first page's `cv`, which the CDN serves
     * only for pages it still caches. Draft walks, and walks under `cache.cv: 'manual'`, aren't
     * pinned, so concurrent edits can skip or repeat items.
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
     * Published walks fail with a `snapshot-changed` `PaginationError` when content is
     * published mid-walk: later pages are pinned to the first page's `cv`, which the CDN serves
     * only for pages it still caches. Draft walks, and walks under `cache.cv: 'manual'`, aren't
     * pinned, so concurrent edits can skip or repeat items.
     */
    iterate: (options?: TOptions): AsyncGenerator<TItem, void, undefined> =>
      paginateItems(toConfig(options)),
  };
};
