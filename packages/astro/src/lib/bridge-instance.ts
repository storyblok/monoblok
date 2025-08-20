import type { StoryblokBridgeV2 } from '@storyblok/js';

/**
 * Waits until the Storyblok Bridge instance (`window.__sbInstance`) is available.
 *
 * - This must only be used **in the browser** (client-side).
 * - The instance will only exist if the Storyblok Bridge script is loaded
 *   (e.g. live preview or bridge integration is enabled).
 * - It will poll until the instance exists.
 * - You can optionally cancel the waiting process using an AbortController.
 *
 * @example
 * ```ts
 * import { waitForStoryblokBridgeInstance } from "@storyblok/astro";
 *
 * // Without cancellation
 * waitForStoryblokBridgeInstance().then((sb) => {
 *   sb?.on(["input", "published", "change"], (event) => {
 *     console.log("Storyblok event:", event);
 *   });
 * });
 *
 * // With cancellation
 * const controller = new AbortController();
 * waitForStoryblokBridgeInstance(controller.signal).then((sb) => {
 *   if (!sb) return; // Waiting was canceled
 *   sb.on("input", (event) => console.log("Input event:", event));
 * });
 *
 * // Cancel later if needed
 * controller.abort();
 * ```
 *
 * @param signal Optional AbortSignal to cancel waiting
 * @returns A promise that resolves with the Storyblok Bridge instance,
 *          or `null` if aborted before it became available
 */
export function waitForStoryblokBridgeInstance(
  signal?: AbortSignal,
): Promise<StoryblokBridgeV2 | null> {
  return new Promise((resolve) => {
    function check() {
      // Stop waiting if the caller aborted
      if (signal?.aborted) {
        resolve(null);
        return;
      }

      // Check if the bridge instance is available on window
      if (typeof window !== 'undefined' && (window as any).__sbInstance) {
        resolve((window as any).__sbInstance as StoryblokBridgeV2);
        return;
      }

      // Retry after a short delay
      setTimeout(check, 50);
    }

    check();
  });
}
