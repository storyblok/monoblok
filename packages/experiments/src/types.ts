import type { ExperimentVariant } from './generated/capi/types.gen';

export type { Experiment, ExperimentVariant } from './generated/capi/types.gen';

/** One `original_slug` → `variant_slug` mapping on a variant. */
export type StoryMapping = ExperimentVariant['story_mappings'][number];

/** A visitor's resolved variant for a single experiment. */
export interface Assignment {
  /** The experiment this assignment belongs to. */
  experimentId: number;
  variant: ExperimentVariant;
}

/** Slim experiment projection carried on an event. */
export interface EventExperiment {
  id: number;
  name: string;
}

/** Slim variant projection carried on an event. */
export interface EventVariant {
  name: string;
  public_id: string;
}

/** An exposure or conversion event handed to an adapter. */
export interface ExperimentEvent {
  type: 'exposure' | 'conversion';
  experiment: EventExperiment;
  variant: EventVariant;
  /** Conversion goal name (e.g. `"signup"`). */
  name?: string;
  /** Arbitrary event properties forwarded to the sink. */
  props?: Record<string, unknown>;
}

/** The event fired when a visitor is exposed to an experiment. */
export type Exposure = ExperimentEvent & { type: 'exposure' };

/**
 * A sink for experiment events. Bring your own, or use `fetchAdapter`. The
 * return value is ignored, so adapters can be sync or async (return a promise
 * to let callers await delivery).
 */
export type Adapter = (event: ExperimentEvent) => unknown;
