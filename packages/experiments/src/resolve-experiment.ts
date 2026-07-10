import type { Assignment, Experiment, ExperimentVariant, Exposure } from './types';

export interface ResolveExperimentOptions {
  experiments: Experiment[];
  slug: string;
  assignment?: Assignment;
}

export interface ResolvedExperiment {
  /** The slug to render: `original_slug` for control, `variant_slug` otherwise. */
  slug: string;
  /** The assigned variant, when an experiment applied. */
  variant?: ExperimentVariant;
  /** The exposure event to fire, when an experiment applied. */
  exposure?: Exposure;
}

/**
 * Maps `slug` + an assignment to the slug that should actually be rendered, plus
 * an exposure descriptor. Pure, no I/O. Returns `slug` unchanged with no
 * exposure when no experiment matches, the assignment is missing, or it belongs
 * to a different experiment.
 */
export function resolveExperiment({ experiments, slug, assignment }: ResolveExperimentOptions): ResolvedExperiment {
  if (!assignment) {
    return { slug };
  }

  // Select the experiment by the assignment, not by first slug match: one story
  // can belong to multiple running experiments, so a slug-first lookup could pick
  // a different experiment than the one the visitor was bucketed into and drop the
  // assignment (no exposure, no remap).
  const experiment = experiments.find(candidate => candidate.id === assignment.experimentId);
  if (!experiment) {
    return { slug };
  }

  // The assigned experiment must actually map this slug; otherwise pass through.
  const mapsSlug = experiment.variants.some(variant =>
    variant.story_mappings.some(mapping => mapping.original_slug === slug),
  );
  if (!mapsSlug) {
    return { slug };
  }

  const variant = experiment.variants.find(candidate => candidate.public_id === assignment.variant.public_id);
  if (!variant) {
    return { slug };
  }

  const exposure: Exposure = {
    type: 'exposure',
    experiment: { id: experiment.id, name: experiment.name },
    variant: { name: variant.name, public_id: variant.public_id },
  };

  // Control renders the original slug; a variant renders its mapped slug.
  if (variant.is_control) {
    return { slug, variant, exposure };
  }

  const mapping = variant.story_mappings.find(candidate => candidate.original_slug === slug);
  return { slug: mapping?.variant_slug ?? slug, variant, exposure };
}
