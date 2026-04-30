const DEFAULT_MAX_CONCURRENT = 6;
const MAX_RATE_LIMIT = 1_000;

export interface RateLimitConfig {
  /**
   * Maximum number of concurrent in-flight requests.
   * Defaults to 6. Capped at 1000.
   */
  maxConcurrency?: number;
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

interface Throttle {
  execute: <T>(fn: () => Promise<T>) => Promise<T>;
  setLimit: (n: number) => void;
}

/**
 * Concurrency limiter: allows up to `initialLimit` requests to be in-flight
 * at the same time. A slot is freed as soon as the request's promise settles
 * (resolves or rejects), so throughput scales with how quickly requests
 * complete rather than being artificially capped at N per second.
 */
export function createThrottle(initialLimit: number): Throttle {
  let limit = initialLimit;
  let activeCount = 0;
  const queue: Array<() => void> = [];

  const tryNext = () => {
    while (queue.length > 0 && activeCount < limit) {
      activeCount++;
      const run = queue.shift()!;
      run();
    }
  };

  const execute = <T>(fn: () => Promise<T>): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      queue.push(() => {
        fn().then(
          (value) => {
            activeCount--;
            tryNext();
            resolve(value);
          },
          (error) => {
            activeCount--;
            tryNext();
            reject(error);
          },
        );
      });
      tryNext();
    });
  };

  const setLimit = (n: number) => {
    limit = n;
    // If the limit increased, unblock any waiting requests.
    tryNext();
  };

  return { execute, setLimit };
}

/**
 * Extracts the quota (`q=`) value from the `X-RateLimit-Policy` response header.
 * Returns `undefined` if the header is absent or unparseable.
 *
 * Example header: `"concurrent-requests";q=30`
 */
export function parseRateLimitPolicyHeader(response: Response): number | undefined {
  const policy = response.headers.get("x-ratelimit-policy");
  if (!policy) {
    return undefined;
  }
  const match = policy.match(/q=(\d+)/);
  if (!match) {
    return undefined;
  }
  return Math.min(Number.parseInt(match[1], 10), MAX_RATE_LIMIT);
}

/**
 * Creates a `ThrottleManager` from the user-supplied `rateLimit` config.
 *
 * - `false`                     -> no throttling (passthrough)
 * - `number`                    -> fixed single queue at that concurrency
 * - `{ maxConcurrency: n }`      -> fixed single queue at n concurrent requests
 * - `{}` / `undefined` (default)-> single queue at DEFAULT_MAX_CONCURRENT
 */
export function createThrottleManager(config: RateLimitConfig | number | false): ThrottleManager {
  // Disabled - every request goes straight through.
  if (config === false) {
    return {
      execute: (fn) => fn(),
      adaptToResponse: () => {},
    };
  }

  const resolvedConfig: RateLimitConfig =
    typeof config === "number" ? { maxConcurrency: config } : config;
  const { maxConcurrency = DEFAULT_MAX_CONCURRENT, adaptToServerHeaders = true } = resolvedConfig;

  const cappedLimit = Math.min(maxConcurrency, MAX_RATE_LIMIT);
  const throttle = createThrottle(cappedLimit);

  return {
    execute: (fn) => throttle.execute(fn),
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
