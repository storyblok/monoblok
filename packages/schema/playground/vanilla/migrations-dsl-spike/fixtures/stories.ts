/**
 * SPIKE fixture content.
 *
 * Reads the same JSON the QA scenario seeds, so the local tests and a space run
 * cannot drift. Shapes (richtext document, embedded `blok` node) are copied
 * from the QA scenario corpus in `packages/migrations/test/scenarios/`, not
 * invented here.
 */
import pageStory from "../scenarios/has-spike-dsl-content/stories/spike-page_1.json";
import articleStory from "../scenarios/has-spike-dsl-content/stories/spike-article_2.json";

export function pageStoryContent(): Record<string, unknown> {
  return structuredClone(pageStory.content) as Record<string, unknown>;
}

export function articleStoryContent(): Record<string, unknown> {
  return structuredClone(articleStory.content) as Record<string, unknown>;
}
