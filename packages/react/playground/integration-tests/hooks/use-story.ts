import useSWR from "swr";
import { apiClient } from "../storyblok";
import { Story } from "../schema/blocks";

async function fetchStory(slug: string): Promise<Story> {
  const result = await apiClient.stories.get(slug, {
    query: { version: "draft", resolve_relations: "featured-articles.posts" },
  });
  if (!result.data) throw new Error(`Story not found: ${slug}`);
  return result.data.story;
}

export function useStoryblokStory(slug: string) {
  return useSWR<Story>(slug, fetchStory);
}
