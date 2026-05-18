import type { SbSDKOptions } from '@storyblok/js';
import type StoryblokComponent from './components/StoryblokComponent.vue';

declare module 'vue' {
  export interface GlobalComponents {
    StoryblokComponent: typeof StoryblokComponent;
  }
}

export type {
  ArrayFn,
  AsyncFn,
  ISbAlternateObject,
  ISbCache,
  ISbConfig,
  ISbContentMangmntAPI,
  ISbDimensions,
  ISbError,
  ISbManagmentApiResult,
  ISbResponse,
  ISbResult,
  ISbSchema,
  ISbStories,
  ISbStoriesParams,
  ISbStory,
  ISbStoryData,
  ISbStoryParams,
  SbBlokData,
  SbBlokKeyDataTypes,
  SbSDKOptions,
  StoryblokBridgeConfigV2,
  StoryblokBridgeV2,
  StoryblokClient,
  StoryblokComponentType,
} from '@storyblok/js';

export interface SbVueSDKOptions extends SbSDKOptions {
  /**
   * Show a fallback component in your frontend if a component is not registered properly.
   */
  enableFallbackComponent?: boolean;
  /**
   * Provide a custom fallback component, e.g. "CustomFallback".
   */
  customFallbackComponent?: string;
}
