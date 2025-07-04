import type { ISbComponentType, ISbStoryData } from 'storyblok-js-client';

/**
 * Bridge event payload interface
 */
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

/**
 * Bridge event types
 */
export type StoryblokBridgeEventType =
  | 'input'
  | 'published'
  | 'change'
  | 'unpublished'
  | 'enterEditmode'
  | 'customEvent';

/**
 * Bridge event callback function
 */
export interface StoryblokBridgeEventCallback {
  (event: ISbEventPayload): void;
}

/**
 * Bridge event for specific story/component actions
 */
export interface StoryblokBridgeEvent {
  action: string;
  event?: string;
  story?: ISbStoryData;
  storyId?: string;
  reload?: boolean;
}
