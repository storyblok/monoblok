import useSWR from "swr";
import type { Story } from "@storyblok/react";
import { client } from "./storyblok";

type StoryQuery = NonNullable<NonNullable<Parameters<typeof client.stories.get>[1]>["query"]>;

const fetcher = ([slug, query]: [string, StoryQuery]): Promise<Story> =>
  client.stories.get(slug, { query, throwOnError: true }).then(({ data }) => data.story);

export function useStoryblokStory(slug: string, query: StoryQuery = { version: "draft" }) {
  return useSWR<Story>([slug, query], fetcher);
}
