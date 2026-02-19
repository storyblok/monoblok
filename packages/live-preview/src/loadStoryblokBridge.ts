import type { BridgeParams,} from '@storyblok/preview-bridge';
import type StoryblokBridge from '@storyblok/preview-bridge';
let bridge: StoryblokBridge | null = null;
let bridgePromise: Promise<StoryblokBridge> | null = null;

/**
 * Get or create a StoryblokBridge instance.
 *
 * @param config Optional configuration for the StoryblokBridge.
 * @returns A promise that resolves to a StoryblokBridge instance.
 */
export async function loadStoryblokBridge(config?: BridgeParams) {
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
