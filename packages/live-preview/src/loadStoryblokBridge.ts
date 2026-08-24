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
 * As a side-effect, exposes deprecated `window.StoryblokBridge` and
 * `window.storyblokRegisterEvent` getters for backward compatibility with
 * legacy consumers. Accessing either global emits a deprecation warning
 * directing users to `loadStoryblokBridge` / `onStoryblokEditorEvent`.
 * These globals will be removed in a future major version.
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

  // Expose legacy globals with a deprecation warning at the point of access.
  // These shims exist only for backward compatibility and will be removed in a
  // future major version. Use `loadStoryblokBridge()` instead.
  const deprecate = (name: string, replacement: string) =>
    console.warn(
      `[Storyblok] \`window.${name}\` is deprecated and will be removed in a future version. ` +
        `Use \`${replacement}\` from \`@storyblok/live-preview\` instead.`,
    );

  Object.defineProperty(window, "StoryblokBridge", {
    get() {
      deprecate("StoryblokBridge", "loadStoryblokBridge");
      return StoryblokBridgeClass;
    },
    configurable: true,
  });

  Object.defineProperty(window, "storyblokRegisterEvent", {
    get() {
      deprecate("storyblokRegisterEvent", "onStoryblokEditorEvent");
      return (cb: () => void) => {
        if (!isInEditor(new URL(window.location.href))) {
          console.warn("[Storyblok] You are not in Draft Mode or in the Visual Editor.");
          return;
        }
        cb();
      };
    },
    configurable: true,
  });

  return new StoryblokBridgeClass(config);
}
