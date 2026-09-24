/**
 * Tells a captured fixture from a projected one, so the generator can refuse to
 * overwrite the first with the second.
 *
 * A projection can only contain what the seed files say. A capture carries what
 * the space did with them, and the space assigns the story its id, so a fixture
 * whose id is not the one its seed file carries came back from a space. That is
 * the whole signal, and it stays true without a marker file for anyone to
 * forget to update.
 *
 * A fixture with no seed file of the same slug is not a candidate either way:
 * the stories under `.storyblok/stories/offline/` are projected by definition,
 * because nothing can push them and so nothing can capture them back.
 */
import type { PlaygroundStory } from "./content-store";

export function capturedSlugs(
  seeded: readonly PlaygroundStory[],
  fixtures: readonly PlaygroundStory[],
): string[] {
  const seedIdBySlug = new Map(seeded.map((story) => [story.slug, story.id]));

  return fixtures
    .filter((fixture) => {
      const seedId = seedIdBySlug.get(fixture.slug);
      return seedId !== undefined && seedId !== fixture.id;
    })
    .map((fixture) => fixture.slug);
}
