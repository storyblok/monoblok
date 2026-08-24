import { StoryblokClient } from "@storyblok/vue";
import { useRuntimeConfig } from "#imports";
import { type H3Event } from "h3";
import type { AllModuleOptions } from "../../types";

export const serverStoryblokClient = (event: H3Event) => {
  const config = useRuntimeConfig();
  const { accessToken } = config.storyblok as AllModuleOptions;
  const { apiOptions = {} } = config.public.storyblok;

  if (!event.context._storyblokClient) {
    event.context._storyblokClient = new StoryblokClient({
      accessToken,
      ...apiOptions,
    });
  }

  return event.context._storyblokClient;
};
