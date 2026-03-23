/* eslint-disable */
import type { StoryblokClient , ISbStoryData } from '@storyblok/astro';

declare global {
  var storyblokApiInstance: StoryblokClient | undefined;

  interface DocumentEventMap {
    /**
     * Dispatched when live preview starts updating. Cancelable.
     * Call event.preventDefault() to skip the update.
     */
    'storyblok-live-preview-updating': CustomEvent<{ story: ISbStoryData }>;
    /**
     * Dispatched when live preview finishes updating.
     */
    'storyblok-live-preview-updated': CustomEvent<{ story: ISbStoryData }>;
  }
}
export {};
