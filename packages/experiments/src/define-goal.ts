/**
 * A conversion goal: what you are measuring, plus optional defaults. This is the
 * input to `track` and `createEvent`, not the payload they produce. An
 * `ExperimentEvent` additionally carries the experiment, the variant, and the
 * visitor, none of which a goal knows about.
 */
export interface ConversionGoal {
  /** Goal name (e.g. `"signup"`). */
  name: string;
  /** Default numeric metric value for the goal. */
  value?: number;
  /** Default event properties, replaced wholesale by a call-site override. */
  props?: Record<string, unknown>;
}

/**
 * Declares a conversion goal once, typically at module scope, so its name and
 * defaults have a single source of truth across a render and a conversion
 * handler. Returns the goal unchanged: it exists for the type checking and the
 * single definition, not for any runtime behavior.
 *
 * ```ts
 * const signup = defineGoal({ name: 'signup', props: { source: 'hero' } });
 * await experiments.track(signup, visitorId);
 * ```
 */
export function defineGoal(goal: ConversionGoal): ConversionGoal {
  return goal;
}
