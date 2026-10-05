import type { Experiment } from "./types";
import { describe, expect, it } from "vitest";
import { findExperimentBySlug } from "./find-experiment-by-slug";
import { homepageExperiment, nestedHomepageExperiment, pricingExperiment } from "./fixtures";

const experiments = [homepageExperiment, pricingExperiment];

describe("findExperimentBySlug", () => {
  it("finds the experiment mapping an original slug", () => {
    expect(findExperimentBySlug({ experiments, slug: "pricing" })?.id).toBe(456);
  });

  it("returns undefined for an unmapped slug", () => {
    expect(findExperimentBySlug({ experiments, slug: "about" })).toBeUndefined();
  });

  it("matches the original story, not a variant slug", () => {
    expect(findExperimentBySlug({ experiments, slug: "home-b" })).toBeUndefined();
  });

  it("matches a folder-nested story by its full slug", () => {
    expect(
      findExperimentBySlug({
        experiments: [nestedHomepageExperiment],
        slug: "campaigns/summer/home",
      })?.id,
    ).toBe(123);
  });

  it("does not match a folder-nested story by its own slug alone", () => {
    expect(
      findExperimentBySlug({ experiments: [nestedHomepageExperiment], slug: "home" }),
    ).toBeUndefined();
  });

  it("does not match a story missing from the experiment's stories", () => {
    const withoutStories: Experiment = { ...homepageExperiment, stories: [] };

    expect(findExperimentBySlug({ experiments: [withoutStories], slug: "home" })).toBeUndefined();
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
