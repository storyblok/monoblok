import type { Assignment, Experiment, Exposure } from "./types";
import { assignVariant } from "./assign-variant";

export interface ResolveRelationsOptions {
  experiments: Experiment[];
  /**
   * UUIDs of the stories related to the page, such as `rels.map((rel) => rel.uuid)`
   * plus any `rel_uuids`.
   */
  uuids: readonly string[];
  visitorId: string;
}

/**
 * The outcome of resolving a page's related stories for one visitor: which of
 * them to render as a variant, and what to report.
 */
export interface ResolvedRelations {
  /**
   * Original story UUID → UUID of the variant story to render in its place.
   * Holds only the stories the visitor sees as a variant, so it is empty for
   * a control visitor and nothing needs fetching.
   */
  variants: Map<string, string>;
  /** One exposure per experiment on a related story, control included. */
  exposures: Exposure[];
  /**
   * `variants` as `original_uuid:variant_uuid` pairs, the value of the stories
   * API `resolve_experiment_variants` parameter. Empty when `variants` is.
   */
  param: string;
}

const exposureFor = (assignment: Assignment): Exposure => ({
  type: "exposure",
  experiment: { ...assignment.experiment },
  variant: { name: assignment.variant.name, public_id: assignment.variant.public_id },
  visitorId: assignment.visitorId,
});

const mapsAnyUuid = (experiment: Experiment, uuids: ReadonlySet<string>): boolean =>
  experiment.variants.some((variant) =>
    variant.story_mappings.some(
      (mapping) => mapping.original_uuid != null && uuids.has(mapping.original_uuid),
    ),
  );

/**
 * Buckets `visitorId` into every running experiment on one of the related
 * stories `uuids` and maps each story to the variant story to render. Pure, no
 * I/O: fetch the variant stories (for example with `by_uuids`) and apply them
 * with `applyRelationVariants`, or pass `param` as `resolve_experiment_variants`.
 *
 * A story in more than one running experiment renders the variant of the
 * first experiment that maps it.
 */
export function resolveRelations({
  experiments,
  uuids,
  visitorId,
}: ResolveRelationsOptions): ResolvedRelations {
  const related = new Set(uuids);
  const variants = new Map<string, string>();
  const exposures: Exposure[] = [];

  for (const experiment of experiments) {
    if (!mapsAnyUuid(experiment, related)) {
      continue;
    }
    const assignment = assignVariant({ experiment, visitorId });
    if (!assignment) {
      continue;
    }
    exposures.push(exposureFor(assignment));

    for (const mapping of assignment.variant.story_mappings) {
      const { original_uuid: originalUuid, variant_uuid: variantUuid } = mapping;
      if (originalUuid == null || variantUuid == null || !related.has(originalUuid)) {
        continue;
      }
      if (!variants.has(originalUuid)) {
        variants.set(originalUuid, variantUuid);
      }
    }
  }

  const param = [...variants]
    .map(([originalUuid, variantUuid]) => `${originalUuid}:${variantUuid}`)
    .join(",");
  return { variants, exposures, param };
}
