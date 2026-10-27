import type { Experiment } from "./types";
import { describe, expect, it } from "vitest";
import { assignVariant } from "./assign-variant";
import { ctaExperiment } from "./fixtures";
import { resolveRelations } from "./resolve-relations";

const alwaysVariant = (experiment: Experiment): Experiment => ({
  ...experiment,
  variants: experiment.variants.map((variant) =>
    variant.is_control ? { ...variant, weight: 0 } : variant,
  ),
});

const urgentVisitor = (experiment: Experiment): string => {
  for (let index = 1; index < 200; index++) {
    const visitorId = `visitor-${index}`;
    if (!assignVariant({ experiment, visitorId })?.variant.is_control) {
      return visitorId;
    }
  }
  throw new Error("no visitor buckets into a variant");
};

describe("resolveRelations", () => {
  it("skips mappings without UUIDs, as returned by APIs that predate them", () => {
    const withoutUuids: Experiment = {
      ...ctaExperiment,
      variants: ctaExperiment.variants.map((variant) => ({
        ...variant,
        story_mappings: variant.story_mappings.map((mapping) => ({
          ...mapping,
          original_uuid: null,
          variant_uuid: null,
        })),
      })),
    };

    const result = resolveRelations({
      experiments: [withoutUuids],
      uuids: ["uuid-cta"],
      visitorId: urgentVisitor(withoutUuids),
    });

    expect(result).toEqual({ variants: new Map(), exposures: [], param: "" });
  });

  it("renders the first experiment's variant for a story in two experiments, exposing both", () => {
    // Zero control weight puts every visitor into the variant, so both experiments apply.
    const first = alwaysVariant(ctaExperiment);
    const second = alwaysVariant({
      ...ctaExperiment,
      id: 790,
      name: "cta_copy_2",
      variants: [
        ctaExperiment.variants[0],
        {
          ...ctaExperiment.variants[1],
          public_id: "var_cta_calm",
          story_mappings: [
            { ...ctaExperiment.variants[1].story_mappings[0], variant_uuid: "uuid-cta-calm" },
          ],
        },
      ],
    });

    const result = resolveRelations({
      experiments: [first, second],
      uuids: ["uuid-cta"],
      visitorId: "visitor-1",
    });

    expect(result.variants).toEqual(new Map([["uuid-cta", "uuid-cta-urgent"]]));
    expect(result.exposures.map((exposure) => exposure.experiment.id)).toEqual([789, 790]);
  });

  it("maps only the related stories of a variant that maps several", () => {
    const twoStories = alwaysVariant({
      ...ctaExperiment,
      variants: [
        ctaExperiment.variants[0],
        {
          ...ctaExperiment.variants[1],
          story_mappings: [
            ...ctaExperiment.variants[1].story_mappings,
            {
              original_story_id: 7,
              original_uuid: "uuid-footer",
              original_slug: "footer",
              variant_story_id: 8,
              variant_uuid: "uuid-footer-urgent",
              variant_slug: "blocks/footer-cta_copy-urgent",
            },
          ],
        },
      ],
    });

    const result = resolveRelations({
      experiments: [twoStories],
      uuids: ["uuid-footer"],
      visitorId: "visitor-1",
    });

    expect(result.param).toBe("uuid-footer:uuid-footer-urgent");
  });
});
