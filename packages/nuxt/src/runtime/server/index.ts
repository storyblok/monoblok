import { StoryblokClient } from '@storyblok/vue';
import { useRuntimeConfig } from '#imports';
import type { H3Event } from 'h3';

export interface PublicModuleOptions {
  accessToken: string; // Storyblok access token
  enableSudoMode: boolean;
  usePlugin: boolean; // legacy opt. for enableSudoMode
  bridge: boolean; // storyblok bridge on/off
  devtools: boolean; // enable nuxt/devtools integration
  apiOptions: any; // storyblok-js-client options
  componentsDir: string; // enable storyblok global directory for components
  serverOnly?: boolean; // keep accessToken server-side only
}

export const serverStoryblokClient = (event: H3Event) => {
  const config = useRuntimeConfig();
  const { accessToken } = config.storyblok as PublicModuleOptions;
  const { apiOptions = {} } = config.public.storyblok;

  event.context.storyblokClient = new StoryblokClient({
    accessToken,
    ...apiOptions,
  });
};
