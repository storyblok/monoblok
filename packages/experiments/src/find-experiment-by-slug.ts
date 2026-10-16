import type { Experiment, StoryMapping } from "./types";

export interface FindExperimentBySlugOptions {
  experiments: Experiment[];
  slug: string;
}

/**
 * The full slug of a mapping's original story. `original_slug` holds only the
 * story's own slug, without its folder path, so the full slug comes from
 * `experiment.stories`.
 */
export function originalFullSlug(
  experiment: Experiment,
  mapping: StoryMapping,
): string | undefined {
  return experiment.stories.find((story) => story.id === mapping.original_story_id)?.full_slug;
}

/** True when any variant of `experiment` maps the original story at `slug`. */
export function mapsSlug(experiment: Experiment, slug: string): boolean {
  return experiment.variants.some((variant) =>
    variant.story_mappings.some((mapping) => originalFullSlug(experiment, mapping) === slug),
  );
}

/**
 * Finds the first running experiment whose original story has the full slug
 * `slug`.
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
