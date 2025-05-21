import type {
  ISbComponentType,
  ISbConfig,
  ISbStoryData,
} from 'storyblok-js-client';
import type StoryblokJSClient from 'storyblok-js-client';

export type StoryblokClient = StoryblokJSClient;

declare global {
  interface Window {
    storyblokRegisterEvent: (cb: () => void) => void;
    StoryblokBridge: {
      new (options?: StoryblokBridgeConfigV2): StoryblokBridgeV2;
    };
  }
}

export interface SbInitResult {
  storyblokApi?: StoryblokClient;
}

export type SbPluginFactory = (options: SbSDKOptions) => any;
export type SbBlokKeyDataTypes = string | number | object | boolean | undefined;

export interface SbBlokData extends ISbComponentType<string> {
  [index: string]: SbBlokKeyDataTypes;
}

export interface SbSDKOptions {
  bridge?: boolean;
  accessToken?: string;
  use?: any[];
  apiOptions?: ISbConfig;
  bridgeUrl?: string;
}

export interface ISbEventPayload<S extends ISbComponentType<string> = any> {
  action:
    | 'customEvent'
    | 'published'
    | 'input'
    | 'change'
    | 'unpublished'
    | 'enterEditmode';
  event?: string;
  story?: ISbStoryData<S>;
  slug?: string;
  slugChanged?: boolean;
  storyId?: number;
  reload?: boolean;
}

// TODO: temporary till the right bridge types are updated on storyblok-js-client
export interface StoryblokBridgeConfigV2 {
  resolveRelations?: string | string[];
  customParent?: string;
  preventClicks?: boolean;
  language?: string;
  resolveLinks?: 'url' | 'story' | '0' | '1' | 'link';
}

export interface StoryblokBridgeV2 {
  pingEditor: (event: any) => void;
  isInEditor: () => boolean;
  enterEditmode: () => void;
  on: (
    event:
      | 'customEvent'
      | 'published'
      | 'input'
      | 'change'
      | 'unpublished'
      | 'enterEditmode'
      | string[],
    callback: (payload?: ISbEventPayload) => void
  ) => void;
}

export type {
  ArrayFn,
  AsyncFn,
  ISbAlternateObject, // previously AlternateObject
  ISbCache, // previously StoryblokCache
  ISbComponentType as StoryblokComponentType,
  ISbConfig, // previously StoryblokConfig
  ISbContentMangmntAPI,
  ISbDimensions,
  ISbError,
  ISbManagmentApiResult, // previously StoryblokManagmentApiResult
  ISbResponse,
  ISbResult, // previously StoryblokResult
  ISbSchema,
  ISbStories, // previously Stories
  ISbStoriesParams, // previously StoriesParams
  ISbStory, // previously Story
  ISbStoryData, // previously StoryData
  ISbStoryParams, // previously StoryParams
  ISbThrottle,
  ISbThrottledRequest,
} from 'storyblok-js-client';
