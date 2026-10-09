/**
 * Fixture content in the shape the Visual Editor writes: a rich text document
 * with an embedded `blok` node.
 */
import pageStory from "./stories/page_1.json";
import articleStory from "./stories/article_2.json";

export function pageStoryContent(): Record<string, unknown> {
  return structuredClone(pageStory.content) as Record<string, unknown>;
}

export function articleStoryContent(): Record<string, unknown> {
  return structuredClone(articleStory.content) as Record<string, unknown>;
}
