import type { ISbStoryData } from 'storyblok-js-client';
import type {
  StoryblokBridgeConfigV2,
  StoryblokEnterEditmodeOptions,
} from './types';
import type {
  StoryblokBridgeEventCallback,
  StoryblokBridgeEventType,
} from './events';

/**
 * Enhanced StoryblokBridge interface based on CDN analysis
 */
export interface StoryblokBridgeV2 {
  /** Ping the editor to establish connection */
  pingEditor: (event?: any) => void;
  /** Check if the current environment is inside the Storyblok editor */
  isInEditor: () => boolean;
  /** Enter edit mode for a specific story/component */
  enterEditmode: (options?: StoryblokEnterEditmodeOptions) => void;
  /** Register event listeners for bridge events */
  on: (
    event: StoryblokBridgeEventType | string[],
    callback: StoryblokBridgeEventCallback
  ) => void;
  /** Trigger a custom event (if available) */
  trigger?: (event: string, payload?: any) => void;
  /** Resolve relations in content (if available) */
  resolveRelations?: (story: ISbStoryData, resolveRelations: string[]) => ISbStoryData;
  /** Get query parameter value (if available) */
  getParam?: (param: string) => string;
  /** Initialize the bridge (if available) */
  init?: () => void;
  /** Clean up event listeners and DOM modifications (if available) */
  destroy?: () => void;
}

/**
 * Bridge constructor interface
 */
export interface StoryblokBridgeConstructor {
  new (options?: StoryblokBridgeConfigV2): StoryblokBridgeV2;
}

/**
 * Global window interface extension
 */
declare global {
  interface Window {
    storyblokRegisterEvent: (cb: () => void) => void;
    StoryblokBridge: StoryblokBridgeConstructor;
  }
}
