import type { ExperimentVariant } from './generated/capi/types.gen';

export type { Experiment, ExperimentVariant } from './generated/capi/types.gen';

/** One `original_slug` → `variant_slug` mapping on a variant. */
export type StoryMapping = ExperimentVariant['story_mappings'][number];

/** A visitor's resolved variant for a single experiment. */
export interface Assignment {
  /** The experiment this assignment belongs to. */
  experimentId: number;
  /** The visitor this assignment was computed for. */
  visitorId: string;
  variant: ExperimentVariant;
}

/**
 * The experiment as carried on an event: just enough to identify it in a sink,
 * without the variants and story mappings that the full `Experiment` config
 * from the API holds.
 */
export interface EventExperiment {
  id: number;
  name: string;
}

/** The variant as carried on an event, identifying it without its config. */
export interface EventVariant {
  name: string;
  public_id: string;
}

/** An exposure or conversion event handed to an adapter. */
export interface ExperimentEvent {
  type: 'exposure' | 'conversion';
  experiment: EventExperiment;
  variant: EventVariant;
  /**
   * The visitor this event belongs to. Use it to join a conversion back to its
   * exposure, and to count each visitor once per variant.
   */
  visitorId: string;
  /** Conversion goal name (e.g. `"signup"`). */
  name?: string;
  /** Numeric metric value for the goal (revenue in cents, cart total, …). */
  value?: number;
  /** Arbitrary event properties forwarded to the sink. */
  props?: Record<string, unknown>;
}

/** The event fired when a visitor is exposed to an experiment. */
export type Exposure = ExperimentEvent & { type: 'exposure' };

/**
 * A sink for experiment events. Bring your own, or use `fetchAdapter`.
 * Adapters can be sync or async: return a promise so callers, and the
 * factory's `flush` and `waitUntil`, can await delivery.
 */
export type Adapter = (event: ExperimentEvent) => unknown;
