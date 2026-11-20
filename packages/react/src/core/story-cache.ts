import type { ISbStoryData } from "@/types";

declare global {
  // eslint-disable-next-line vars-on-top
  var storyCache: Map<string, ISbStoryData>;
}

globalThis.storyCache = globalThis.storyCache || new Map<string, ISbStoryData>();

/**
 * Live-edit updates are handed from the server action to the re-render that
 * Next.js performs in the same action response, so entries only need to live
 * for a very short time. Stale entries are dropped instead of being served later.
 */
export const STORY_CACHE_TTL_MS = 30_000;
/** Upper bound on cached live-edit updates, to prevent unbounded memory growth. */
export const STORY_CACHE_MAX_ENTRIES = 100;

const expiresAt = new WeakMap<ISbStoryData, number>();

/** Returns the shared cache key for a Storyblok story. */
export const getStoryCacheKey = (
  story: Pick<ISbStoryData, "id"> | null | undefined,
): string | null => {
  if (typeof story?.id !== "number") {
    return null;
  }

  return String(story.id);
};

const isExpired = (story: ISbStoryData, now: number): boolean => {
  const expiry = expiresAt.get(story);
  return expiry !== undefined && expiry <= now;
};

const pruneStoryCache = (now: number): void => {
  const cache = globalThis.storyCache;
  for (const [key, story] of cache) {
    if (isExpired(story, now)) {
      cache.delete(key);
    }
  }
  // Map iteration follows insertion order, so the first keys are the oldest.
  while (cache.size > STORY_CACHE_MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value as string;
    cache.delete(oldestKey);
  }
};

/**
 * Stores a live-edit update for a story. Only call this after the caller has
 * been verified as a Storyblok Visual Editor session.
 */
export const setCachedStory = (story: ISbStoryData, now: number = Date.now()): boolean => {
  const cacheKey = getStoryCacheKey(story);
  if (!cacheKey) {
    return false;
  }

  const cache = globalThis.storyCache;
  // Re-insert so the key moves to the end of the insertion order.
  cache.delete(cacheKey);
  cache.set(cacheKey, story);
  expiresAt.set(story, now + STORY_CACHE_TTL_MS);
  pruneStoryCache(now);
  return true;
};

/** Merges and consumes a cached live-edit update for a story id. */
export const consumeCachedStory = (story: ISbStoryData, now: number = Date.now()): ISbStoryData => {
  const cacheKey = getStoryCacheKey(story);

  if (!cacheKey) {
    return story;
  }

  const cached = globalThis.storyCache.get(cacheKey);
  globalThis.storyCache.delete(cacheKey);

  if (!cached || isExpired(cached, now)) {
    return story;
  }

  return { ...story, ...cached };
};
