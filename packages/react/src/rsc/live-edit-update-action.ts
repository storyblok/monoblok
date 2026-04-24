'use server';
import type { ISbStoryData } from '@storyblok/js';
import { getStoryCacheKey } from '../core/story-cache';

export async function liveEditUpdateAction({
  story,
  pathToRevalidate,
}: {
  story: ISbStoryData;
  pathToRevalidate: string;
}) {
  if (!story || !pathToRevalidate) {
    return console.error('liveEditUpdateAction: story or pathToRevalidate is not provided');
  }

  const cacheKey = getStoryCacheKey(story);
  if (cacheKey) {
    globalThis.storyCache?.set(cacheKey, story);
  }

  // Revalidate path in Next.js SDKs only
  if (process.env.NEXT_RUNTIME) {
    try {
      const { revalidatePath } = await import('next/cache');
      revalidatePath(pathToRevalidate);
    }
    catch (error) {
      console.error('liveEditUpdateAction: error while revalidating path', error);
    }
  }
}
