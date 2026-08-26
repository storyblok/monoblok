import useSWR from "swr";
import type { Story } from "@storyblok/react";
import { apiClient } from "../storyblok";

async function fetchStory(slug: string): Promise<Story> {
  const result = await apiClient.stories.get(slug, { query: { version: "draft" } });
  if (!result.data) throw new Error(`Story not found: ${slug}`);
  return result.data.story;
}

export function useStory(slug: string) {
  return useSWR<Story>(slug, fetchStory);
}
