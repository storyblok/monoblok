import { clampRequestsPerSecond } from "./limiter";
import { MAX_RATE_LIMIT } from "./request-admission";

export const RATE_LIMIT_POLICY_HEADER = "x-ratelimit-policy";
export const CACHE_STATUS_HEADER = "x-cache";

/** Policy names ending in this describe a cap on simultaneous requests, not a rate. */
const CONCURRENCY_POLICY_SUFFIX = "concurrent-requests";
/** One member of the policy list: a quoted name followed by its own `;k=v` parameters. */
const POLICY_MEMBER = /"([^"]+)"((?:;[^,]*)*)/g;
/**
 * Longest window whose quota still describes a rate rather than a budget. A
 * daily allowance spread evenly would pace far below the rate the same header
 * advertises for the second, and exhausting an allowance surfaces as the
 * throttled responses the back-off already answers.
 */
const MAX_POLICY_WINDOW_SECONDS = 60;

/**
 * Reads the per-second rate the API advertises in an `X-RateLimit-Policy`
 * header value.
 *
 * The header carries one or more comma-separated policies, each a quoted name
 * followed by its parameters: a quota (`q`) and the window in seconds it
 * applies over (`w`). The rate is `q/w`, so a quota means nothing without its
 * window, and a policy carrying only a quota is skipped.
 *
 * Some policies cap simultaneous requests rather than a rate. Their quota is a
 * count, and adopting it as a rate would throttle far below what the API
 * allows.
 */
export function parseRateLimitPolicy(policy: string | null | undefined): number | undefined {
  if (!policy) {
    return undefined;
  }

  // Exceeding any of the advertised policies gets the request throttled, so the
  // strictest one governs. Reading only the first would let the order the
  // header happens to list them in decide the rate.
  let strictest: number | undefined;
  for (const [, name, params] of policy.matchAll(POLICY_MEMBER)) {
    if (name!.endsWith(CONCURRENCY_POLICY_SUFFIX)) {
      continue;
    }

    const quota = Number(params!.match(/;q=(\d+)/)?.[1]);
    const windowSeconds = Number(params!.match(/;w=(\d+)/)?.[1]);
    if (!quota || !windowSeconds || windowSeconds > MAX_POLICY_WINDOW_SECONDS) {
      continue;
    }

    const rate = quota / windowSeconds;
    strictest = strictest === undefined ? rate : Math.min(strictest, rate);
  }

  if (strictest === undefined) {
    return undefined;
  }

  return Math.min(clampRequestsPerSecond(Math.floor(strictest)), MAX_RATE_LIMIT);
}

/**
 * A revalidated entry is reported with its own status ("RefreshHit"), and that
 * revalidation reaches the origin, so only a plain hit is free.
 */
const CACHE_HIT_STATUS = "hit";
/** One status per cache the response passed through, joined as a header list. */
const CACHE_STATUS_SEPARATOR = /\s*,\s*/;
/** A status is its own word followed by the cache that produced it: `Hit from cloudfront`. */
const CACHE_STATUS_WORDS = /\s+/;

/**
 * Reads from an `X-Cache` header value whether the CDN answered a response
 * from its cache rather than from the origin.
 *
 * A response that passed through more than one cache carries one status per
 * hop, which arrives as a single comma-joined value. It only spared the origin
 * if every hop served it, so each is matched as a whole word — a substring
 * match would make the answer depend on which hop happened to be listed first.
 *
 * Returns `undefined` when there is no cache status. Browsers are the case
 * that matters: the header is not among the ones the API exposes to
 * cross-origin script, so a browser client can never observe a hit and stays
 * at the origin tier.
 */
export function parseCacheStatus(header: string | null | undefined): boolean | undefined {
  if (header === null || header === undefined) {
    return undefined;
  }

  const statuses = header.trim().split(CACHE_STATUS_SEPARATOR).filter(Boolean);
  if (statuses.length === 0) {
    return undefined;
  }

  return statuses.every(
    (status) => status.split(CACHE_STATUS_WORDS)[0]?.toLowerCase() === CACHE_HIT_STATUS,
  );
}
