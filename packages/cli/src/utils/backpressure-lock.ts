import { Sema } from 'async-sema';
import { getActiveConfig } from '../lib/config';

// 2× the per-second rate limit so the pipeline always has work queued for the
// next API window without over-loading memory.
// In edge-case scenarios like ~2 s request duration: 12 / 2 s = 6 req/s, saturating the
// default 6 req/s rate limit. If requests take longer (e.g. 2.5 s →
// 12 / 2.5 s = 4.8 req/s) the pipeline under-utilises the limit slightly
const PIPELINE_BACKPRESSURE_MULTIPLIER = 2;
const DEFAULT_PIPELINE_BACKPRESSURE = 12;

export function createPipelineBackpressureLock(limit?: number): Sema {
  const rateLimit = getActiveConfig().api.rateLimit;
  const n = limit ?? (rateLimit > 0 ? rateLimit * PIPELINE_BACKPRESSURE_MULTIPLIER : DEFAULT_PIPELINE_BACKPRESSURE);
  return new Sema(n);
}
