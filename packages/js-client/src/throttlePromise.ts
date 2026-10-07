import { createThrottle } from "@storyblok/utils/rate-limiting";
import type { ISbThrottle } from "./interfaces";

/**
 * Wraps `fn` in a rate limiter: at most `limit` calls may start within any
 * rolling `interval` in milliseconds (see `createThrottle`). A non-positive or
 * non-finite `limit` or `interval` disables throttling. Server-side rate limits
 * remain enforced by the client's 429 retry path.
 */
function throttledQueue<T extends (...args: Parameters<T>) => ReturnType<T>>(
  fn: T,
  limit: number,
  interval: number,
): ISbThrottle<T> {
  const throttle = createThrottle(limit, { intervalMs: interval });
  const throttled: ISbThrottle<T> = (...args) => throttle.acquire().then(() => fn(...args));
  throttled.abort = throttle.abort;
  return throttled;
}

export default throttledQueue;
