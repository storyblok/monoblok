import type { Adapter, ExperimentEvent } from './types';

export interface TrackEventOptions {
  adapter: Adapter;
}

/**
 * Sends an experiment event to a sink. The event is the subject; `adapter` is
 * the pluggable destination (see `@storyblok/experiments/adapters` or bring
 * your own).
 */
export function trackEvent(event: ExperimentEvent, { adapter }: TrackEventOptions): unknown {
  return adapter(event);
}
