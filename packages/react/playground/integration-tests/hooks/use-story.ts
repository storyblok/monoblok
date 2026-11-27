import useSWR from "swr";
import { apiClient } from "../storyblok";

// The client infers a richer type than the plain `Story` here: `resolve_relations`
// is a literal, so `inlineRelations: true` (set on `apiClient`) types every
// `featured-articles.posts` field as the related story, at any nesting depth —
// see `WithInlinedRelations` in `@storyblok/api-client`. Let TS infer the
// fetcher's return instead of annotating it with `Story`, which predates that
// resolution and only knows `posts` as a plain UUID string.
async function fetchStory(slug: string) {
  const result = await apiClient.stories.get(slug, {
    query: { version: "draft", resolve_relations: "featured-articles.posts" },
  });
  if (!result.data) throw new Error(`Story not found: ${slug}`);
  return result.data.story;
}

export function useStoryblokStory(slug: string) {
  return useSWR(slug, fetchStory);
}
