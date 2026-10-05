import type { Experiment, StoryMapping } from "./types";

export interface FindExperimentBySlugOptions {
  experiments: Experiment[];
  slug: string;
}

/**
 * The full slug of a mapping's original story. `original_slug` holds only the
 * story's own slug, which drops its folder path, so `experiment.stories` is the
 * source of truth. `original_slug` covers payloads from API versions that predate
 * `stories`, which only resolve root-level stories.
 */
export function originalFullSlug(experiment: Experiment, mapping: StoryMapping): string | null {
  const story = experiment.stories?.find((candidate) => candidate.id === mapping.original_story_id);
  return story?.full_slug ?? mapping.original_slug;
}

/** True when any variant of `experiment` maps the original story at `slug`. */
export function mapsSlug(experiment: Experiment, slug: string): boolean {
  return experiment.variants.some((variant) =>
    variant.story_mappings.some((mapping) => originalFullSlug(experiment, mapping) === slug),
  );
}

/**
 * Finds the first running experiment that maps the original story at the full
 * slug `slug`.
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
