import type React from 'react';
import type { ISbStoryData, SbSDKOptions, StoryblokBridgeConfigV2, StoryblokRichTextNode, StoryblokRichTextOptions } from '@storyblok/js';

export interface SbReactComponentsMap {
  [key: string]: React.ElementType;
}

export interface SbReactSDKOptions extends SbSDKOptions {
  components?: SbReactComponentsMap;
  enableFallbackComponent?: boolean;
  customFallbackComponent?: React.ElementType;
}

export type TUseStoryblokState = <T = void>(
  initialStory: ISbStoryData<T> | null,
  bridgeOptions?: StoryblokBridgeConfigV2
) => ISbStoryData<T> | null;

export interface StoryblokRichTextProps {
  doc: StoryblokRichTextNode<React.ReactElement>;
  tiptapExtensions?: StoryblokRichTextOptions<React.ReactElement>['tiptapExtensions'];
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
  ISbThrottle,
  SbBlokData,
  SbBlokKeyDataTypes,
  SbSDKOptions,
  StoryblokBridgeConfigV2,
  StoryblokBridgeV2,
  StoryblokClient,
  StoryblokComponentType,
  useStoryblokBridge,
} from '@storyblok/js';
