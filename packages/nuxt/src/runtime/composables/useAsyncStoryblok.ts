import { useStoryblokApi, useStoryblokBridge } from '@storyblok/vue';
import type { ISbResult, ISbStoriesParams, StoryblokBridgeConfigV2 } from '@storyblok/vue';
import { computed, type ComputedRef, useAsyncData, watch } from '#imports';
import type { AsyncData, AsyncDataOptions, NuxtError } from 'nuxt/app';

/**
 * Options for the useAsyncStoryblok composable.
 * Extends Nuxt's AsyncDataOptions with Storyblok-specific configuration.
 */
export interface UseAsyncStoryblokOptions extends AsyncDataOptions<ISbResult> {
  /** Storyblok API parameters for fetching stories */
  api: ISbStoriesParams;
  /** Storyblok Bridge configuration for live preview */
  bridge: StoryblokBridgeConfigV2;
}

export interface UseAsyncStoryblokResult extends AsyncData<ISbResult, NuxtError<unknown>> {
  story: ComputedRef<ISbResult['data']['story']>;
}

/**
 * Creates a stable string representation of an object by sorting its keys.
 * This ensures consistent caching keys for useAsyncData regardless of property order.
 *
 * @param obj - The object to stringify
 * @returns A stable JSON string representation of the object
 *
 * @example
 * ```typescript
 * const obj1 = { b: 2, a: 1 }
 * const obj2 = { a: 1, b: 2 }
 * stableStringify(obj1) === stableStringify(obj2) // true
 * ```
 */
const stableStringify = (obj: Record<string, any>): string => {
  const sortedKeys = Object.keys(obj).sort();
  const sortedObj = sortedKeys.reduce((acc, key) => {
    acc[key] = obj[key];
    return acc;
  }, {} as Record<string, any>);
  return JSON.stringify(sortedObj);
};

/**
 * Composable for fetching Storyblok stories with async data handling and live preview support.
 *
 * This composable combines Nuxt's useAsyncData with Storyblok's bridge functionality to provide:
 * - Async data fetching with loading and error states
 * - Automatic caching based on URL and API parameters
 * - Live preview updates when editing in Storyblok
 * - SSR/SSG compatibility
 *
 * @param url - The story URL path (e.g., 'home', 'blog/my-post')
 * @param options - Configuration options for AsyncData, API calls and bridge setup
 * @returns An object containing the async data result with additional story computed property
 *
 * @example
 * ```vue
 * <script setup>
 * const { data, pending, error, story } = await useAsyncStoryblok('home', {
 *   api: {
 *     version: 'published', // or 'draft' for preview
 *     cv: Date.now()
 *   },
 *   bridge: {
 *     resolveRelations: ['featured-posts.posts', 'featured-posts.authors'],
 *     resolveLinks: 'url'
 *   }
 * })
 * </script>
 *
 * <template>
 *   <div v-if="pending">Loading...</div>
 *   <div v-else-if="error">Error: {{ error.message }}</div>
 *   <div v-else>
 *     <h1>{{ story?.content?.title }}</h1>
 *     <div v-html="story?.content?.body"></div>
 *   </div>
 * </template>
 * ```
 *
 */
export const useAsyncStoryblok = async (
  url: string,
  options: UseAsyncStoryblokOptions,
): Promise<UseAsyncStoryblokResult> => {
  const storyblokApiInstance = useStoryblokApi();
  const { api, bridge, ...rest } = options;
  const uniqueKey = `${stableStringify(api)}${url}`;

  const result = await useAsyncData(uniqueKey, () => storyblokApiInstance.get(`cdn/stories/${url}`, api), rest);

  if (import.meta.client) {
    watch(result.data, (newData) => {
      if (newData?.data.story && newData.data.story.id) {
        useStoryblokBridge(newData.data.story.id, (evStory) => {
          newData.data.story = evStory;
        }, bridge);
      }
    }, {
      immediate: true,
    });
  }

  return {
    ...result,
    story: computed(() => result.data.value?.data.story),
  } as UseAsyncStoryblokResult;
};
