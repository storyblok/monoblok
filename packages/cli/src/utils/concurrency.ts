import { Sema } from 'async-sema';
import { getActiveConfig } from '../lib/config';

// Default used when rateLimit is disabled (<=0) or unset
const DEFAULT_CONCURRENCY = 12;

export function createConcurrencyLock(limit?: number): Sema {
  const n = limit ?? getActiveConfig().api.rateLimit;
  return new Sema(n > 0 ? n : DEFAULT_CONCURRENCY);
}
