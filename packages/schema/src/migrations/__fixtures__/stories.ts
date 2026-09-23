/**
 * Fixture content: the same story JSON a space is seeded with, so the local
 * tests and a run against a real space cannot drift. The shapes (richtext
 * document, embedded `blok` node) are what the editor writes, not inventions.
 */
import pageStory from "./stories/spike-page_1.json";
import articleStory from "./stories/spike-article_2.json";

export function pageStoryContent(): Record<string, unknown> {
  return structuredClone(pageStory.content) as Record<string, unknown>;
}

export function articleStoryContent(): Record<string, unknown> {
  return structuredClone(articleStory.content) as Record<string, unknown>;
}
