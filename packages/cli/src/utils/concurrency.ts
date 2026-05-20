import { Sema } from 'async-sema';
import { getActiveConfig } from '../lib/config';

// 2× the per-second rate limit so the pipeline always has work queued for the
// next API window without over-loading memory.
const PIPELINE_BACKPRESSURE_MULTIPLIER = 2;
const DEFAULT_PIPELINE_BACKPRESSURE = 12;

export function createPipelineBackpressureLock(limit?: number): Sema {
  const rateLimit = getActiveConfig().api.rateLimit;
  const n = limit ?? (rateLimit > 0 ? rateLimit * PIPELINE_BACKPRESSURE_MULTIPLIER : DEFAULT_PIPELINE_BACKPRESSURE);
  return new Sema(n);
}
