import type { BridgeParams,} from '@storyblok/preview-bridge';
import { isBrowser } from './utils/isBrowser';
import { isInEditor } from './utils/isInEditor';
import type StoryblokBridge from '@storyblok/preview-bridge';
import type { ISbComponentType, ISbStoryData } from 'storyblok-js-client';
let bridge: StoryblokBridge | null = null;
let bridgePromise: Promise<StoryblokBridge> | null = null;

/**
 * Get or create a StoryblokBridge instance.
 *
 * @param config Optional configuration for the StoryblokBridge.
 * @returns A promise that resolves to a StoryblokBridge instance.
 */
async function getBridge(config?: BridgeParams) {
  if (bridge) return bridge;

  if (!bridgePromise) {
    bridgePromise = import('@storyblok/preview-bridge').then(
      ({ default: StoryblokBridge }) => {
        bridge = new StoryblokBridge(config);
        return bridge;
      },
    );
  }

  return bridgePromise;
}

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
  if (!isBrowser()) return;
  if (!isInEditor(new URL(window.location.href))) return;

  const bridge = await getBridge(bridgeOptions);

  bridge.on(['input', 'change', 'published'], (event) => {
    if (!event) return;

    if ( event.action === 'input' ) {
      const eventStoryId = event.story.id;
      if (eventStoryId !== storyId) return;
      callback(event.story as ISbStoryData<T>);
      return;
    }

    if (event.action === 'change' || event.action === 'published') {
            const eventStoryId = event.storyId
      if (eventStoryId !== storyId) return;
      window.location.reload();
    }
  });
}
