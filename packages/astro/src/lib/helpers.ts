import type { ISbStoryData, StoryblokClient } from '../types';
import type { AstroGlobal } from 'astro';

export function useStoryblokApi(): StoryblokClient {
  if (!globalThis?.storyblokApiInstance) {
    throw new Error('storyblokApiInstance has not been initialized correctly');
  }
  return globalThis.storyblokApiInstance;
}

/**
 * Retrieves the current live Storyblok story during preview mode.
 *
 * @param Astro - The Astro global object provided in server-side rendering.
 * @returns The live Storyblok story data if available, otherwise `null`.
 */
// TODO: should we pass the Astro object to this function or only the locals object?
export async function getLiveStory(
  Astro: Readonly<AstroGlobal>,
): Promise<ISbStoryData | null> {
  return Astro.locals?._storyblok_preview_data ?? null;
}
