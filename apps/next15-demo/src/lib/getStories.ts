import { client } from "./client";
import { ISbStoriesParams } from "@storyblok/js";

export const getStories = async (params: ISbStoriesParams) => {
  return client.get(`cdn/stories`, {
    ...params,
    resolve_links: "url"
  })
};
