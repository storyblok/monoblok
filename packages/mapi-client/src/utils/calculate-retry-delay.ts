/**
 * Calculates the delay for the next retry attempt using exponential backoff with full jitter.
 *
 * @param attempt The current retry attempt number (starting from 0 for the first retry).
 * @param baseDelay The initial delay in milliseconds (e.g., 100).
 * @param maxDelay The maximum possible delay in milliseconds (e.g., 20000).
 * @returns The calculated delay in milliseconds to wait before the next attempt.
 */
export function calculateRetryDelay(
  attempt: number,
  baseDelay: number = 100,
  maxDelay: number = 20000,
): number {
  const exponentialBackoff = baseDelay * 2 ** attempt;
  const cappedBackoff = Math.min(exponentialBackoff, maxDelay);
  // Apply full jitter: a random value between 0 and the capped backoff
  const jitter = Math.random() * cappedBackoff;

  return jitter;
}
