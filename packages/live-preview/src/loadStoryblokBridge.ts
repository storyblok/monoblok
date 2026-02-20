import type StoryblokBridge from '@storyblok/preview-bridge';
import type { BridgeParams } from '@storyblok/preview-bridge';


let bridgePromise: Promise<StoryblokBridge> | undefined
let storedConfig: BridgeParams | undefined = undefined;

/**
 * Get or create a StoryblokBridge instance.
 *⚠️ The bridge is a singleton. Configuration is applied only on first load.
 * @param config Optional configuration for the StoryblokBridge.
 * @returns A promise that resolves to a StoryblokBridge instance.
 */
export function loadStoryblokBridge(config?: BridgeParams) {
  if (bridgePromise) {
    if (config && !Object.is(config, storedConfig)) {
      throw new Error(
        '[Storyblok] Preview Bridge already initialized with a different configuration. ' +
        'The bridge can only be created once per page and does not support runtime reconfiguration.',
      )
    }
    return bridgePromise
  }

  storedConfig = config

  bridgePromise = import('@storyblok/preview-bridge')
    .then(({ default: StoryblokBridge }) => new StoryblokBridge(config))
    .catch((error) => {
      bridgePromise = undefined
      storedConfig = undefined
      throw error
    })

  return bridgePromise
}
