import useSWR from "swr";
import { ISbStoryData } from "storyblok-js-client";
import { getStory } from "@/lib/getStory";

const fetcher = (key: string) => getStory(key).then(res => res.data.story);

export const useStory = <T = unknown>(slug: string) => {
  const { data, error, isLoading } = useSWR(`cdn/stories/${slug}`, fetcher);

  return { story: data as ISbStoryData<T>, error, isLoading };
}
