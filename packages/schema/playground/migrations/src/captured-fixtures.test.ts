import { describe, expect, it } from "vitest";

import { capturedSlugs } from "./captured-fixtures";
import type { PlaygroundStory } from "./content-store";

function story(slug: string, id: number): PlaygroundStory {
  return { id, slug, name: slug, content: { _uid: slug, component: "page" } };
}

describe("telling a captured fixture from a projected one", () => {
  it("should name a story whose fixture carries an id its seed file never had", () => {
    const seeded = [story("home", 1001), story("team", 1002)];
    const fixtures = [story("home", 223408651877959), story("team", 1002)];

    expect(capturedSlugs(seeded, fixtures)).toEqual(["home"]);
  });

  it("should name nothing when every fixture still carries its seed file's id", () => {
    const seeded = [story("home", 1001), story("team", 1002)];

    expect(capturedSlugs(seeded, [story("home", 1001), story("team", 1002)])).toEqual([]);
  });

  it("should not mistake a story with no seed file for a captured one", () => {
    // The pre-migration story is projected from `.storyblok/stories/offline/`,
    // which the push never sees, so nothing could have captured it.
    const seeded = [story("home", 1001)];
    const fixtures = [story("home", 1001), story("legacy", 1005)];

    expect(capturedSlugs(seeded, fixtures)).toEqual([]);
  });

  it("should name every captured story, not only the first", () => {
    const seeded = [story("home", 1001), story("team", 1002), story("pricing", 1003)];
    const fixtures = [
      story("home", 223408651877959),
      story("team", 1002),
      story("pricing", 223408652004938),
    ];

    expect(capturedSlugs(seeded, fixtures)).toEqual(["home", "pricing"]);
  });
});
