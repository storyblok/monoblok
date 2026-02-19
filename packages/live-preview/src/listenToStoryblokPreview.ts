import type { BridgeParams,} from '@storyblok/preview-bridge';
import type { ISbComponentType, ISbStoryData } from 'storyblok-js-client';
import { loadStoryblokBridge } from './loadStoryblokBridge';
import { canUseStoryblokBridge } from './utils/canUseStoryblokBridge';


/**
 * Listens to Storyblok preview events on the client.
 * The listener:
 * - Runs only in the browser and inside the Storyblok editor
 * - Lazily loads the Storyblok Preview Bridge
 * - Calls the callback on `input` events
 * - Reloads the page on `change` and `published` events
 *
 * @param callback
 * Called with the updated story data when an `input` event is received.
 *
 * @param bridgeOptions
 * Optional configuration passed to the Storyblok Preview Bridge.
 * @example
 * ```ts
 * listenToStoryblokPreview((story) => {
 *   updateState(story);
 * });
 * ```
 */
export const listenToStoryblokPreview = async <T extends ISbComponentType<string> = any,>(
  callback: (newStory: ISbStoryData<T>) => void,
  bridgeOptions?: BridgeParams,
): Promise<void> => {
  if (!canUseStoryblokBridge()) return;

  const bridge = await loadStoryblokBridge(bridgeOptions);

  bridge.on(['input', 'change', 'published'], (event) => {
    if (!event) return;

    if ( event.action === 'input' ) {
      callback(event.story as ISbStoryData<T>);
      return;
    }

    if (event.action === 'change' || event.action === 'published') {
      window.location.reload();
    }
  });
}
