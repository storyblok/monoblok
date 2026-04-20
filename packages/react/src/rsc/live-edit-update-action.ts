'use server';
import type { ISbStoryData } from '@storyblok/js';

export async function liveEditUpdateAction({
  story,
  pathToRevalidate,
  cacheKey,
}: {
  story: ISbStoryData;
  pathToRevalidate: string;
  cacheKey?: string;
}) {
  if (!story || !pathToRevalidate) {
    return console.error('liveEditUpdateAction: story or pathToRevalidate is not provided');
  }

  // Visual History events ship minimal `{ id, content }` payloads without a uuid.
  // Callers pass `cacheKey` (e.g. `id:<id>`) so the cache entry is retrievable
  // after revalidation, since the server-fetched draft has a different uuid.
  const key = cacheKey ?? story.uuid;
  if (key) {
    globalThis.storyCache?.set(key, story);
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
