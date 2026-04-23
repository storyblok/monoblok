import type { ISbStoryData } from '@/types';

declare global {
  // eslint-disable-next-line vars-on-top
  var storyCache: Map<string, ISbStoryData>;
}

globalThis.storyCache = globalThis.storyCache || new Map<string, ISbStoryData>();

/** Returns the shared cache key for a Storyblok story. */
export const getStoryCacheKey = (story: Pick<ISbStoryData, 'id'> | null | undefined): string | null => {
  if (typeof story?.id !== 'number') {
    return null;
  }

  return String(story.id);
};

/** Merges and consumes a cached live-edit update for a story id. */
export const consumeCachedStory = (story: ISbStoryData): ISbStoryData => {
  const cacheKey = getStoryCacheKey(story);

  if (!cacheKey) {
    return story;
  }

  const cached = globalThis.storyCache.get(cacheKey);
  globalThis.storyCache.delete(cacheKey);

  return cached ? { ...story, ...cached } : story;
};
