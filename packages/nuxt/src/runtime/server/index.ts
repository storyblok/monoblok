import { StoryblokClient } from '@storyblok/vue';
import { useRuntimeConfig } from '#imports';
import type { H3Event } from 'h3';
import type { AllModuleOptions } from '../../types';

export const serverStoryblokClient = (event: H3Event) => {
  const config = useRuntimeConfig();
  const { accessToken } = config.storyblok as AllModuleOptions;
  const { apiOptions = {} } = config.public.storyblok;

  if (!accessToken) {
    throw new Error(
      `Storyblok access token is not configured. Make sure to set storyblok.accessToken in your nuxt.config.ts and enable storyblok.enableServerClient = true to use the server-side client.`,
    );
  }

  if (!event.context._storyblokClient) {
    event.context._storyblokClient = new StoryblokClient({
      accessToken,
      ...apiOptions,
    });
  }

  return event.context._storyblokClient;
};
