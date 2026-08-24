import type StoryblokBridge from "@storyblok/preview-bridge";
import type { BridgeParams } from "@storyblok/preview-bridge";

import { isBrowser } from "./utils/isBrowser";
import { isInEditor } from "./utils/isInEditor";

declare global {
  interface Window {
    storyblokRegisterEvent: (cb: () => void) => void;
    StoryblokBridge: new (options?: BridgeParams) => StoryblokBridge;
  }
}

/**
 * Loads the Storyblok Preview Bridge and returns a new instance.
 *
 * As a side-effect, exposes the bridge class on `window.StoryblokBridge`
 * and registers `window.storyblokRegisterEvent` for backward compatibility
 * with code that uses the legacy window-based bridge pattern.
 *
 * The bridge is not a singleton — each call returns a new instance.
 * The underlying module import is deduplicated automatically by the ES
 * module cache, so the network request only happens once.
 *
 * @param config Optional configuration for the StoryblokBridge.
 * @returns A promise that resolves to a new StoryblokBridge instance.
 */
export async function loadStoryblokBridge(config?: BridgeParams): Promise<StoryblokBridge> {
  if (!isBrowser()) {
    throw new Error("Cannot load Storyblok bridge: window is undefined (server-side environment)");
  }

  const { default: StoryblokBridgeClass } = await import("@storyblok/preview-bridge");

  // Expose the class on window so legacy code using `new window.StoryblokBridge(opts)`
  // continues to work. Setting this on every call is intentionally idempotent.
  window.StoryblokBridge = StoryblokBridgeClass;

  // Provide the legacy callback helper. By the time this runs the bridge class
  // is already loaded, so registered callbacks fire immediately.
  window.storyblokRegisterEvent = (cb: () => void) => {
    if (!isInEditor(new URL(window.location.href))) {
      console.warn("You are not in Draft Mode or in the Visual Editor.");
      return;
    }
    cb();
  };

  return new StoryblokBridgeClass(config);
}
