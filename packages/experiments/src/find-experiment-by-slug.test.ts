import type { Experiment } from "./types";
import { describe, expect, it } from "vitest";
import { findExperimentBySlug } from "./find-experiment-by-slug";
import { homepageExperiment, pricingExperiment } from "./fixtures";

const experiments = [homepageExperiment, pricingExperiment];

describe("findExperimentBySlug", () => {
  it("finds the experiment mapping an original slug", () => {
    expect(findExperimentBySlug({ experiments, slug: "pricing" })?.id).toBe(456);
  });

  it("returns undefined for an unmapped slug", () => {
    expect(findExperimentBySlug({ experiments, slug: "about" })).toBeUndefined();
  });

  it("matches on original_slug, not on a variant slug", () => {
    expect(findExperimentBySlug({ experiments, slug: "home-b" })).toBeUndefined();
  });

  it("matches folder-nested full slugs", () => {
    const nested: Experiment = {
      ...homepageExperiment,
      variants: [
        {
          ...homepageExperiment.variants[0],
          story_mappings: [
            {
              original_story_id: 1,
              original_slug: "pages/home",
              variant_story_id: 1,
              variant_slug: "pages/home",
            },
          ],
        },
      ],
    };

    expect(findExperimentBySlug({ experiments: [nested], slug: "pages/home" })?.id).toBe(123);
  });

  it("returns the first match when several experiments share a slug", () => {
    const second: Experiment = { ...homepageExperiment, id: 999, name: "homepage_hero_2" };

    expect(
      findExperimentBySlug({ experiments: [homepageExperiment, second], slug: "home" })?.id,
    ).toBe(123);
  });

  it("returns undefined for an empty experiment list", () => {
    expect(findExperimentBySlug({ experiments: [], slug: "home" })).toBeUndefined();
  });
});
