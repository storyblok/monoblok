import type {
  ISbStoryData,
  StoryblokBridgeConfigV2,
  StoryblokClient,
} from '../types';
import type { AstroGlobal } from 'astro';

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
 * @deprecated Use `getPayload()` instead for better type safety and to access both story and serverData.
 * @see {@link getPayload}
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
export async function getLiveStory(
  Astro: Readonly<AstroGlobal>,
): Promise<ISbStoryData | null> {
  let story: ISbStoryData | null = null;
  if (Astro && Astro.locals._storyblok_preview_data) {
    story = Astro.locals._storyblok_preview_data.story || null;
  }
  return story;
}

/**
 * Retrieves the live Storyblok story and server data from Astro's `locals` during preview mode.
 *
 * This function is primarily useful when working with the Storyblok Visual Editor
 * and live preview updates in an Astro project.
 *
 * @template ServerData - The type of server data, constrained to StoryblokServerData
 * @template Story - The type of story data, constrained to ISbStoryData
 * @param {object} params - The function parameters
 * @param {object} params.locals - The Astro locals object
 * @returns {Promise<{ story?: Story; serverData?: ServerData }>} An object containing the story and serverData if available
 *
 * @example
 * ```ts
 * // Basic usage:
 * const payload = await getPayload({ locals: Astro.locals });
 * const story = payload.story ?? null;
 *
 * // With typed server data:
 * interface ServerData {
 *   users?: User[];
 * }
 *
 * interface MyStory extends ISbStoryData {
 *   content: { myField: string };
 * }
 *
 * const payload = await getPayload<ServerData, MyStory>({ locals: Astro.locals });
 * const story = payload.story ?? null;
 * const users = payload.serverData?.users ?? [];
 * ```
 */

export async function getPayload<
  ServerData extends object = object,
  Story extends ISbStoryData = ISbStoryData,
>({
  locals,
}: {
  locals: {
    _storyblok_preview_data?: {
      serverData?: ServerData;
      story?: Story;
    };
  };
}): Promise<{ story?: Story; serverData?: ServerData }> {
  const { story, serverData } = locals._storyblok_preview_data || {};
  return { story, serverData };
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
