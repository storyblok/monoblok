import type { ConversionGoal } from "./define-goal";
import type { Assignment, Conversion } from "./types";

export interface CreateConversionOptions {
  /** The assignment to attribute the conversion to. */
  assignment: Assignment;
  /** The goal that was reached, as a name or a `defineGoal` declaration. */
  goal: string | ConversionGoal;
  /** Numeric metric value, replacing the goal's default. */
  value?: number;
  /** Event properties, replacing the goal's defaults wholesale. */
  props?: Record<string, unknown>;
}

/**
 * Builds the conversion event for one assignment. Pure, no I/O, and total: an
 * assignment already names the experiment, the variant, and the visitor, so
 * nothing can be missing and there is no lookup to fail.
 *
 * The counterpart to the exposure that `resolveExperiment` produces. Pair it
 * with `assignVariant` to attribute a goal without the factory, or use the
 * factory's `createEvent`, which is this function with the adapters bound.
 */
export function createConversion({
  assignment,
  goal,
  value,
  props,
}: CreateConversionOptions): Conversion {
  const resolvedGoal = typeof goal === "string" ? { name: goal } : goal;
  const resolvedValue = value ?? resolvedGoal.value;
  const resolvedProps = props ?? resolvedGoal.props;

  return {
    type: "conversion",
    experiment: { ...assignment.experiment },
    variant: { name: assignment.variant.name, public_id: assignment.variant.public_id },
    visitorId: assignment.visitorId,
    name: resolvedGoal.name,
    ...(resolvedValue === undefined ? {} : { value: resolvedValue }),
    ...(resolvedProps === undefined ? {} : { props: resolvedProps }),
  };
}
