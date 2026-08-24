import useSWR from "swr";
import type { Story } from "@storyblok/react";
import { client } from "./storyblok";

const fetcher = (slug: string): Promise<Story> =>
  client.get(`cdn/stories/${slug}`, { version: "draft" }).then((res) => res.data.story);

export function useStoryblokStory(slug: string) {
  return useSWR<Story>(slug, fetcher);
}
