import { createThrottle } from './throttle';

const DEFAULT_REQUESTS_PER_SECOND = 6;
const MAX_RATE_LIMIT = 1_000;

export interface RateLimitConfig {
  /**
   * Maximum number of MAPI requests to start per second.
   * Defaults to 6. Capped at 1000.
   */
  requestsPerSecond?: number;
  /**
   * @deprecated Use `requestsPerSecond` instead.
   * @todo(next-major): Remove this field.
   */
  maxConcurrency?: number;
}

export interface ThrottleManager {
  execute: <T>(fn: () => Promise<T>) => Promise<T>;
}

/**
 * Creates a `ThrottleManager` from the user-supplied `rateLimit` config.
 *
 * - `false`                       -> no throttling (passthrough)
 * - `number`                      -> N requests per second
 * - `{ requestsPerSecond: n }`    -> N requests per second
 * - `{}` / `undefined` (default)  -> DEFAULT_REQUESTS_PER_SECOND per second
 */
export function createThrottleManager(config: RateLimitConfig | number | false): ThrottleManager {
  if (config === false) {
    return { execute: fn => fn() };
  }

  const resolvedConfig: RateLimitConfig = typeof config === 'number' ? { requestsPerSecond: config } : config;
  const { requestsPerSecond, maxConcurrency } = resolvedConfig;
  const rps = requestsPerSecond ?? maxConcurrency ?? DEFAULT_REQUESTS_PER_SECOND;
  const throttle = createThrottle(Math.min(rps, MAX_RATE_LIMIT));

  return {
    execute: fn => throttle.execute(fn),
  };
}
