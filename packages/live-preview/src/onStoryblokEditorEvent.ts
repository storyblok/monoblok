import type { BridgeParams } from '@storyblok/preview-bridge';
import { loadStoryblokBridge } from './loadStoryblokBridge';
import { canUseStoryblokBridge } from './utils/canUseStoryblokBridge';

/**
 * Internal listener registry for Storyblok `input` events.
 * Each listener receives the updated story data from the Visual Editor.
 */
const inputListeners = new Set<(story: unknown) => void>();

/**
 * Tracks whether the Storyblok Preview Bridge event listeners
 * have already been registered.
 */
let bridgeInitPromise: Promise<void> | undefined;

/**
 * Initializes the Storyblok Preview Bridge and attaches event listeners.
 *
 * This function ensures that the bridge is only initialized once per page.
 *
 * Registered events:
 * - `input` → Dispatches updated story data to all registered listeners.
 * - `change` → Forces a full page reload.
 * - `published` → Forces a full page reload.
 *
 * @param bridgeOptions Optional configuration for the Preview Bridge.
 */
async function initializeBridge(bridgeOptions?: BridgeParams): Promise<void> {
  if (!canUseStoryblokBridge()) {
    return;
  }

  // If initialization already started, reuse it
  if (bridgeInitPromise) {
    return bridgeInitPromise;
  }

  bridgeInitPromise = (async () => {
    const bridge = await loadStoryblokBridge(bridgeOptions);

    bridge.on(['input', 'change', 'published'], (event) => {
      if (!event) {
        return;
      }

      if (event.action === 'input' && event.story) {
        for (const listener of inputListeners) {
          listener(event.story);
        }
        return;
      }

      if (event.action === 'change' || event.action === 'published') {
        window.location.reload();
      }
    });
  })();

  return bridgeInitPromise;
}

/**
 * Registers a callback for Storyblok Visual Editor live preview updates.
 *
 * The consumer provides the expected story type through the generic `T`.
 *
 * @typeParam T - Story type expected by the consumer.
 *
 * @param callback
 * Callback executed when the Visual Editor sends an `input` event.
 *
 * @param bridgeOptions
 * Optional configuration for the Preview Bridge.
 *
 * @example
 * ```ts
 * const cleanup = await onStoryblokEditorEvent((story) => {
 *   console.log('Live updated story:', story)
 * })
 *
 * // later
 * cleanup()
 * ```
 */
export async function onStoryblokEditorEvent<
  T = unknown,
>(
  callback: (story: T) => void,
  bridgeOptions?: BridgeParams,
): Promise<() => void> {
  await initializeBridge(bridgeOptions);

  const listener = (story: unknown) => {
    callback(story as T);
  };

  inputListeners.add(listener);

  return () => {
    inputListeners.delete(listener);
  };
}
