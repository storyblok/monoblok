import { type ISbResult, type ISbStoriesParams, type StoryblokBridgeConfigV2, useStoryblokApi, useStoryblokBridge } from '@storyblok/vue';
import { computed, type ComputedRef, type Ref, watch } from 'vue';
import { useAsyncData } from '#app';
import type { AsyncData, AsyncDataOptions, NuxtError } from '#app';

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

interface AsyncDataExecuteOptions {
  dedupe?: 'cancel' | 'defer';
}

export interface UseAsyncStoryblokResult {
  story: ComputedRef<ISbResult['data']['story']>;
  /** In Nuxt 3: null when not loaded. In Nuxt 4: undefined when not loaded. */
  data: Ref<ISbResult | null | undefined>;
  pending: Ref<boolean>;
  /** In Nuxt 3: null when no error. In Nuxt 4: undefined when no error. */
  error: Ref<NuxtError<unknown> | null | undefined>;
  refresh: (opts?: AsyncDataExecuteOptions) => Promise<void>;
  execute: (opts?: AsyncDataExecuteOptions) => Promise<void>;
  clear: () => void;
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
export async function useAsyncStoryblok(
  url: string,
  options: UseAsyncStoryblokOptions,
): Promise<UseAsyncStoryblokResult> {
  const storyblokApiInstance = useStoryblokApi();
  const { api, bridge = {}, ...rest } = options;
  const uniqueKey = `${stableStringify(api)}${url}`;

  // Copy resolve_relations and resolve_links from API options to bridge options
  // This ensures the bridge resolves the same relations during live preview updates
  const bridgeOptions: StoryblokBridgeConfigV2 = {
    ...bridge,
    resolveRelations: bridge.resolveRelations ?? api.resolve_relations,
    resolveLinks: bridge.resolveLinks ?? api.resolve_links,
  };

  const result = await useAsyncData(uniqueKey, () => storyblokApiInstance.get(`cdn/stories/${url}`, api), rest) as AsyncData<ISbResult, NuxtError<unknown>>;

  // Register bridge for live preview updates (client-side only)
  // Use watch instead of onMounted because lifecycle hooks must be registered before the first await
  // in async setup functions, but we can't as we need the story.id
  if (import.meta.client) {
    const registerBridge = (storyId: number) => {
      useStoryblokBridge(storyId, (evStory) => {
        // In Nuxt 4, data is a shallowRef - we must replace the entire object
        // to trigger reactivity instead of mutating nested properties
        if (result.data.value) {
          result.data.value = {
            ...result.data.value,
            data: {
              ...result.data.value.data,
              story: evStory,
            },
          };
        }
      }, bridgeOptions);
    };

    const id = result.data.value?.data?.story?.id;
    if (id) {
      registerBridge(id);
    }
    else {
      // Wait for data to become available, then register bridge once
      const stopWatch = watch(
        () => result.data.value?.data?.story?.id,
        (storyId) => {
          if (storyId) {
            stopWatch();
            registerBridge(storyId);
          }
        },
      );
    }
  }

  return {
    data: result.data,
    pending: result.pending,
    error: result.error,
    refresh: result.refresh,
    execute: result.execute,
    clear: result.clear,
    story: computed(() => result.data.value?.data.story),
  };
}
