import type { BridgeParams } from '@storyblok/preview-bridge';
import { loadStoryblokBridge } from './loadStoryblokBridge';
import { canUseStoryblokBridge } from './utils/canUseStoryblokBridge';
import type { ISbComponentType, ISbStoryData } from 'storyblok-js-client';

/**
 * Registers a callback for Storyblok Visual Editor events.
 *
 * Behavior:
 * - On `input` events, the callback is called with the updated story data.
 * - On `change` and `published` events, the page is reloaded to reflect the latest content.
 *
 * @param callback - Called on `input` events with the updated story data.
 * @param bridgeOptions - Optional Preview Bridge configuration. Applied only on first initialization.
 *
 * @example
 * ```ts
 * onStoryblokEditorEvent((story) => {
 *   console.log('Live updated story:', story)
 * })
 * ```
 */
export const onStoryblokEditorEvent = async <T extends ISbComponentType<string> = any,> (
  callback: (newStory: ISbStoryData<T>) => void,
  bridgeOptions?: BridgeParams,
): Promise<void> => {
  if (!canUseStoryblokBridge()) return

  const bridge = await loadStoryblokBridge(bridgeOptions)
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
