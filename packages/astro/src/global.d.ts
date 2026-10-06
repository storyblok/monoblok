/* eslint-disable */
declare global {
  interface DocumentEventMap {
    /**
     * Dispatched when live preview starts updating. Cancelable.
     * Call event.preventDefault() to skip the update.
     */
    "storyblok-live-preview-updating": CustomEvent<{ story: unknown }>;
    /**
     * Dispatched when live preview finishes updating.
     */
    "storyblok-live-preview-updated": CustomEvent<{ story: unknown }>;
  }
}
export {};
