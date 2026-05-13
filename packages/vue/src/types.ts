import type { SbBlokData, SbSDKOptions } from '@storyblok/js';
import type { SbRichTextDoc, SbRichTextImageOptions } from '@storyblok/richtext';
import type StoryblokComponent from './components/StoryblokComponent.vue';
import type { SbVueComponentMap } from './composables/useStoryblokRichText';

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

export type {
  SbRichTextDoc,
  SbRichTextImageOptions,
} from '@storyblok/richtext';

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

export interface SbComponentProps {
  blok: SbBlokData;
}

export interface StoryblokRichTextProps {
  doc: SbRichTextDoc | SbRichTextDoc[] | null | undefined;
  optimizeImage?: boolean | Partial<SbRichTextImageOptions>;
  components?: SbVueComponentMap;
}
