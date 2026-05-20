import type { SbBlokData, SbSDKOptions } from '@storyblok/js';
import type { Component } from 'svelte';

export type StoryblokComponentProps<T> = {
  blok: T;
} & Record<string, unknown>;

export interface SbSvelteComponentsMap {
  [name: string]: Component<StoryblokComponentProps<SbBlokData>>;
}

export interface SbSvelteSDKOptions extends SbSDKOptions {
  components?: SbSvelteComponentsMap | CallableFunction;
}

export type {
  ISbAlternateObject,
  ISbCache,
  ISbConfig,
  ISbManagmentApiResult,
  ISbResult,
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
  useStoryblokBridge,
} from '@storyblok/js';
