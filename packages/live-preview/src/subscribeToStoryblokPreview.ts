import type { BridgeParams,} from '@storyblok/preview-bridge';
import type { ISbComponentType, ISbStoryData } from 'storyblok-js-client';
import { loadStoryblokBridge } from './loadStoryblokBridge';
import { canUseStoryblokBridge } from './utils/canUseStoryblokBridge';


/**
 * Registers a Storyblok Preview Bridge listener for a specific story.
 *
 * This function listens to Storyblok editor events and reacts as follows:
 * - `input`: Emits the updated story content via the callback when the story ID matches
 * - `change` / `published`: Reloads the page when the story ID matches
 *
 * The listener is only registered in a browser environment and only when
 * the current page is opened inside the Storyblok editor.
 *
 * The preview bridge is lazy-loaded and initialized on demand.
 *
 * @typeParam T - The Storyblok component schema type of the story content
 *
 * @param storyId - The numeric ID of the story to listen for
 * @param callback - Called with the updated story data on `input` events
 * @param bridgeOptions - Configuration options passed to the Preview Bridge constructor
 *
 * @returns A promise that resolves once the listener has been registered.
 *
 * @example
 * ```ts
 * subscribeToStoryblokPreview(123, (story) => {
 *   updateState(story);
 * });
 * ```
 */
export const subscribeToStoryblokPreview = async <T extends ISbComponentType<string> = any,>(
  storyId: number,
  callback: (newStory: ISbStoryData<T>) => void,
  bridgeOptions: BridgeParams,
): Promise<void> => {
  if (!canUseStoryblokBridge()) return;

  const bridge = await loadStoryblokBridge(bridgeOptions);

  bridge.on(['input', 'change', 'published'], (event) => {
    if (!event) return;

    if ( event.action === 'input' ) {
      const eventStoryId = event.story.id;
      if (eventStoryId !== storyId) return;
      callback(event.story as ISbStoryData<T>);
      return;
    }

    if (event.action === 'change' || event.action === 'published') {
      const eventStoryId = event.storyId;
      if (eventStoryId !== storyId) return;
      window.location.reload();
    }
  });
}
