import type { AsyncData, AsyncDataOptions, NuxtError } from 'nuxt/app';
import type {
  ISbResult,
  ISbStoriesParams,
  StoryblokBridgeConfigV2,
} from '@storyblok/vue';
import type { ComputedRef } from 'vue';

/**
 * Options for the useAsyncStoryblok composable.
 * Extends Nuxt's AsyncDataOptions with Storyblok-specific configuration.
 */
export interface UseAsyncStoryblokOptions extends AsyncDataOptions<ISbResult> {
  /** Storyblok API parameters for fetching stories */
  api: ISbStoriesParams;
  /** Storyblok Bridge configuration for live preview */
  bridge?: StoryblokBridgeConfigV2;
}

export interface UseAsyncStoryblokResult
  extends AsyncData<ISbResult, NuxtError<unknown>> {
  story: ComputedRef<ISbResult['data']['story']>;
}

export interface ModuleOptions {
  accessToken: string;
  enableSudoMode: boolean;
  usePlugin: boolean; // legacy opt. for enableSudoMode
  bridge: boolean; // storyblok bridge on/off
  devtools: boolean; // enable nuxt/devtools integration
  apiOptions: any; // storyblok-js-client options
  componentsDir: string; // enable storyblok global directory for components
}
