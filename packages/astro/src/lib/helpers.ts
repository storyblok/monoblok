import type {
  ISbStoryData,
  StoryblokBridgeConfigV2,
  StoryblokClient,
} from '../types';

/**
 * Returns the Storyblok API client instance.
 *
 * This function gives you access to the `StoryblokClient` that is initialized
 * when setting up the Storyblok SDK in your Astro configuration.
 *
 * @throws {Error} If the `storyblokApiInstance` has not been initialized in Astro config.
 * @returns {StoryblokClient} The initialized Storyblok API client instance.
 *
 * @example
 * ```ts
 * // In an Astro route or integration code:
 * const storyblokApi = useStoryblokApi();
 * const { data } = await storyblokApi.get('cdn/stories/home');
 * ```
 */
export function useStoryblokApi(): StoryblokClient {
  if (!globalThis?.storyblokApiInstance) {
    throw new Error('storyblokApiInstance has not been initialized correctly');
  }
  return globalThis.storyblokApiInstance;
}

/**
 * Retrieves the live Storyblok story from Astro's `locals` during preview mode.
 *
 * This function is primarily useful when working with the Storyblok Visual Editor
 * and live preview updates in an Astro project.
 *
 * @param {Readonly<AstroGlobal>} Astro - The Astro global object.
 * @returns {Promise<ISbStoryData | null>} The Storyblok story data if available,
 * otherwise `null`.
 *
 * @example
 * ```ts
 * const story = await getLiveStory(Astro);
 * if (story) {
 *   console.log('Previewing story:', story.name);
 * }
 * ```
 */
interface Payload<T = unknown> {
  story: ISbStoryData | null;
  serverData?: T;
}

export async function getLiveStory<T = unknown>({ locals }: { locals: App.Locals }): Promise<Payload<T> | null> {
  if (locals && locals._storyblok_preview_data) {
    const { story, serverData } = locals._storyblok_preview_data;
    return { story: story || null, serverData: serverData as T | undefined };
  }
  return null;
}

export function initStoryblokBridge(
  config: boolean | StoryblokBridgeConfigV2,
): string {
  if (typeof config === 'object') {
    const bridgeConfig = JSON.stringify(config);
    return `const storyblokInstance = new StoryblokBridge(${bridgeConfig});`;
  }
  return 'const storyblokInstance = new StoryblokBridge();';
}
