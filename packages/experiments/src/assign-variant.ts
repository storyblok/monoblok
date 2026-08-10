import type { Assignment, Experiment, ExperimentVariant } from "./types";
import { hashToBucket } from "./hash";

export interface AssignVariantOptions {
  experiment: Experiment;
  visitorId: string;
}

// The assignment carries the experiment's identity rather than only its id, so
// building a conversion from it needs no lookup. `experimentId` is the
// deprecated 1.x spelling of `experiment.id`.
const assignmentFor = (
  experiment: Experiment,
  visitorId: string,
  variant: ExperimentVariant,
): Assignment => ({
  experiment: { id: experiment.id, name: experiment.name },
  experimentId: experiment.id,
  visitorId,
  variant,
});

/**
 * Deterministically buckets `visitorId` into one of the experiment's variants
 * by walking their cumulative weights. Sticky (same `visitorId` + experiment →
 * same variant) and storage-free. Honors `is_control` as the fallback when no
 * variant carries positive weight. Returns `undefined` for an experiment with
 * no variants.
 */
export function assignVariant({
  experiment,
  visitorId,
}: AssignVariantOptions): Assignment | undefined {
  const { variants } = experiment;
  if (variants.length === 0) {
    return undefined;
  }

  const totalWeight = variants.reduce((sum, variant) => sum + Math.max(0, variant.weight), 0);

  // No positive weights: fall back to the control variant (or the first one).
  if (totalWeight <= 0) {
    const fallback = variants.find((variant) => variant.is_control) ?? variants[0];
    return assignmentFor(experiment, visitorId, fallback);
  }

  // Map the 0..99 bucket onto the cumulative weight distribution.
  const target = (hashToBucket(`${visitorId}:${experiment.id}`) / 100) * totalWeight;
  let cumulative = 0;
  for (const variant of variants) {
    cumulative += Math.max(0, variant.weight);
    if (target < cumulative) {
      return assignmentFor(experiment, visitorId, variant);
    }
  }

  // Floating-point edge: fall through to the last weighted variant.
  return assignmentFor(experiment, visitorId, variants[variants.length - 1]);
}
