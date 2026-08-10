import type { Assignment, Experiment } from "./types";

/**
 * An assignment shaped exactly as `assignVariant` builds one, for tests that
 * need a specific variant rather than whatever the visitor hashes into.
 */
export function assignmentFor(
  experiment: Experiment,
  variantIndex: number,
  visitorId = "visitor-1",
): Assignment {
  return {
    experiment: { id: experiment.id, name: experiment.name },
    experimentId: experiment.id,
    visitorId,
    variant: experiment.variants[variantIndex],
  };
}

/**
 * A homepage experiment with a 50/50 control/variant split. `control` renders
 * the original `home` slug; variant `b` renders `home-b`.
 */
export const homepageExperiment: Experiment = {
  id: 123,
  name: "homepage_hero",
  display_name: "Homepage Hero",
  story_ids: [1, 2],
  variants: [
    {
      name: "control",
      display_name: "Control",
      public_id: "var_control",
      weight: 50,
      is_control: true,
      story_mappings: [
        { original_story_id: 1, original_slug: "home", variant_story_id: 1, variant_slug: "home" },
      ],
    },
    {
      name: "b",
      display_name: "Variant B",
      public_id: "var_b",
      weight: 50,
      is_control: false,
      story_mappings: [
        {
          original_story_id: 1,
          original_slug: "home",
          variant_story_id: 2,
          variant_slug: "home-b",
        },
      ],
    },
  ],
};

/**
 * A second, unrelated experiment on the `pricing` slug. Used to cover the
 * multi-experiment case: a visitor is bucketed into every running experiment,
 * not only the one whose slug was rendered.
 */
export const pricingExperiment: Experiment = {
  id: 456,
  name: "pricing_table",
  display_name: "Pricing Table",
  story_ids: [3, 4],
  variants: [
    {
      name: "control",
      display_name: "Control",
      public_id: "var_pricing_control",
      weight: 50,
      is_control: true,
      story_mappings: [
        {
          original_story_id: 3,
          original_slug: "pricing",
          variant_story_id: 3,
          variant_slug: "pricing",
        },
      ],
    },
    {
      name: "compact",
      display_name: "Compact",
      public_id: "var_pricing_compact",
      weight: 50,
      is_control: false,
      story_mappings: [
        {
          original_story_id: 3,
          original_slug: "pricing",
          variant_story_id: 4,
          variant_slug: "pricing-compact",
        },
      ],
    },
  ],
};
