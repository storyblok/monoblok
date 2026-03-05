import { createThrottle, parseRateLimitPolicyHeader } from '@storyblok/api-client';

export { parseRateLimitPolicyHeader } from '@storyblok/api-client';

const DEFAULT_MAX_CONCURRENT = 6;
const MAX_RATE_LIMIT = 1_000;

export interface RateLimitConfig {
  /**
   * Maximum number of concurrent in-flight requests.
   * Defaults to 6. Capped at 1000.
   */
  maxConcurrent?: number;
  /**
   * Dynamically adjust the rate limit based on the `X-RateLimit-Policy`
   * response header returned by the Storyblok API.
   * @default true
   */
  adaptToServerHeaders?: boolean;
}

export interface ThrottleManager {
  execute: <T>(fn: () => Promise<T>) => Promise<T>;
  adaptToResponse: (response: Response | undefined) => void;
}

/**
 * Creates a `ThrottleManager` from the user-supplied `rateLimit` config.
 *
 * - `false`                     → no throttling (passthrough)
 * - `number`                    → fixed single queue at that concurrency
 * - `{ maxConcurrent: n }`      → fixed single queue at n concurrent requests
 * - `{}` / `undefined` (default)→ single queue at DEFAULT_MAX_CONCURRENT
 */
export function createThrottleManager(config: RateLimitConfig | number | false): ThrottleManager {
  // Disabled — every request goes straight through.
  if (config === false) {
    return {
      execute: fn => fn(),
      adaptToResponse: () => {},
    };
  }

  const resolvedConfig: RateLimitConfig = typeof config === 'number' ? { maxConcurrent: config } : config;
  const { maxConcurrent = DEFAULT_MAX_CONCURRENT, adaptToServerHeaders = true } = resolvedConfig;

  const cappedLimit = Math.min(maxConcurrent, MAX_RATE_LIMIT);
  const throttle = createThrottle(cappedLimit);

  return {
    execute: fn => throttle.execute(fn),
    adaptToResponse: (response) => {
      if (!adaptToServerHeaders || response === undefined) {
        return;
      }
      const serverLimit = parseRateLimitPolicyHeader(response);
      if (serverLimit !== undefined) {
        // Never exceed the user-configured ceiling.
        throttle.setLimit(Math.min(cappedLimit, serverLimit));
      }
    },
  };
}
