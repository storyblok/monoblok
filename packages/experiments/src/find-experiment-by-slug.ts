import type { Experiment } from "./types";

export interface FindExperimentBySlugOptions {
  experiments: Experiment[];
  slug: string;
}

/** True when any variant of `experiment` maps `slug` as an `original_slug`. */
export function mapsSlug(experiment: Experiment, slug: string): boolean {
  return experiment.variants.some((variant) =>
    variant.story_mappings.some((mapping) => mapping.original_slug === slug),
  );
}

/**
 * Finds the first running experiment that maps `slug` as an `original_slug`.
 * Returns `undefined` when no experiment applies to the slug.
 *
 * A story can belong to more than one running experiment, so prefer selecting
 * by an existing assignment's `experiment.id` when you have one — this lookup is
 * for the case where you only know the slug.
 */
export function findExperimentBySlug({
  experiments,
  slug,
}: FindExperimentBySlugOptions): Experiment | undefined {
  return experiments.find((candidate) => mapsSlug(candidate, slug));
}
