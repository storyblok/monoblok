import type { BridgeParams } from '@storyblok/preview-bridge';
import type { Story } from './generated/types/story';

import { loadStoryblokBridge } from './loadStoryblokBridge';
import { canUseStoryblokBridge } from './utils/canUseStoryblokBridge';

type Prettify<T> = { [K in keyof T]: T[K] } & {};

/**
 * The story payload delivered by the Visual Editor `input` event.
 *
 * The Preview Bridge streams a story whose full runtime shape is not
 * guaranteed to match the CDN API. Only `id`, `uuid`, and `content` are
 * relied upon here — their types are sourced from the supplied {@link Story}
 * generic — while every other field is left as `unknown` rather than
 * over-promising a fully typed CDN story.
 *
 * @typeParam TStory - The schema-aware {@link Story} to source field types from.
 */
export type LivePreviewStory<TStory extends Story = Story> = Prettify<
  Pick<TStory, 'id'>
  & Partial<Pick<TStory, 'uuid' | 'content'>>
  & {
    [key: string]: unknown;
  }
>;

/**
 * Internal listener registry for Storyblok `input` events.
 * Each listener receives the updated story data from the Visual Editor.
 */
const inputListeners = new Set<(story: LivePreviewStory) => void>();

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
          listener(event.story as LivePreviewStory);
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
 * This utility connects to the Storyblok Preview Bridge and listens
 * for Visual Editor events.
 *
 * Behavior:
 * - **input** → Calls the provided callback with the updated story data.
 * - **change** → Reloads the page.
 * - **published** → Reloads the page.
 *
 * Multiple listeners can be registered simultaneously. Each call returns
 * a cleanup function that removes the registered listener.
 *
 * @typeParam TStory - The schema-aware {@link Story} type to type the payload against.
 *
 * @param callback
 * Callback executed when the Visual Editor sends an `input` event.
 *
 * @param bridgeOptions
 * Optional configuration for the Storyblok Preview Bridge.
 * This configuration is applied **only during the first initialization**.
 *
 * @returns
 * A cleanup function that removes the registered listener.
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
export async function onStoryblokEditorEvent<TStory extends Story = Story>(
  callback: (story: LivePreviewStory<TStory>) => void,
  bridgeOptions?: BridgeParams,
): Promise<() => void> {
  await initializeBridge(bridgeOptions);

  const listener = (story: LivePreviewStory<TStory>) => {
    callback(story);
  };

  inputListeners.add(listener);

  return () => {
    inputListeners.delete(listener);
  };
}
