import useSWR from "swr";
import { apiClient } from "../storyblok";
import { Story } from "@storyblok/api-client";

async function fetchStory(slug: string): Promise<Story> {
  const result = await apiClient.stories.get(slug, {
    query: { version: "draft" },
  });
  if (!result.data) throw new Error(`Story not found: ${slug}`);
  return result.data.story;
}

export function useStoryblokStory(slug: string) {
  return useSWR<Story>(slug, fetchStory);
}
