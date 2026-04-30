import type { BridgeParams } from "@storyblok/preview-bridge";
import type { ISbComponentType, ISbStoryData } from "storyblok-js-client";

import { loadStoryblokBridge } from "./loadStoryblokBridge";
import { canUseStoryblokBridge } from "./utils/canUseStoryblokBridge";

/**
 * Internal listener registry for Storyblok `input` events.
 * Each listener receives the updated story data from the Visual Editor.
 */
const inputListeners = new Set<(story: ISbStoryData) => void>();

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

    bridge.on(["input", "change", "published"], (event) => {
      if (!event) {
        return;
      }

      if (event.action === "input" && event.story) {
        for (const listener of inputListeners) {
          listener(event.story as ISbStoryData);
        }
        return;
      }

      if (event.action === "change" || event.action === "published") {
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
 * @typeParam T - The Storyblok component schema type.
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
export async function onStoryblokEditorEvent<
  T extends ISbComponentType<string> = ISbComponentType<string>,
>(callback: (story: ISbStoryData<T>) => void, bridgeOptions?: BridgeParams): Promise<() => void> {
  await initializeBridge(bridgeOptions);

  const listener = (story: ISbStoryData) => {
    callback(story as ISbStoryData<T>);
  };

  inputListeners.add(listener);

  return () => {
    inputListeners.delete(listener);
  };
}
