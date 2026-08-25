import type { AsyncData, AsyncDataOptions, NuxtError } from "#app";
import { useAsyncData, useRuntimeConfig } from "#app";
import {
  type ISbStoriesParams,
  type ISbStory,
  type StoryblokBridgeConfigV2,
  useStoryblokApi,
  useStoryblokBridge,
} from "@storyblok/vue";
import { computed, type ComputedRef, type MaybeRefOrGetter, type Ref, toValue, watch } from "vue";

/**
 * Options for the useAsyncStoryblok composable.
 * Extends Nuxt's AsyncDataOptions with Storyblok-specific configuration.
 *
 * @typeParam T - The story's `content` shape. Defaults to `any`.
 */
export interface UseAsyncStoryblokOptions<T = any> extends AsyncDataOptions<ISbStory<T>> {
  /**
   * Storyblok API parameters for fetching stories.
   *
   * Accepts a plain object, a ref, a computed, or a getter. The current value
   * is read (via `toValue`) on every fetch, so reactive params stay in sync.
   * Note that changing a reactive value does not auto-refetch on its own —
   * trigger a re-fetch by calling `refresh()` or by passing a `watch` option
   * (e.g. `watch: [version]`), which Nuxt's `useAsyncData` re-runs on.
   */
  api: MaybeRefOrGetter<ISbStoriesParams>;
  /**
   * Storyblok Bridge configuration for live preview.
   *
   * Optional: when omitted, the bridge is still registered and inherits
   * `resolve_relations` and `resolve_links` from the `api` options.
   * Pass `false` to disable bridge registration entirely.
   */
  bridge?: StoryblokBridgeConfigV2 | false;
}

interface AsyncDataExecuteOptions {
  dedupe?: "cancel" | "defer";
}

export interface UseAsyncStoryblokResult<T = any> {
  story: ComputedRef<ISbStory<T>["data"]["story"] | undefined>;
  /** In Nuxt 3: null when not loaded. In Nuxt 4: undefined when not loaded. */
  data: Ref<ISbStory<T> | null | undefined>;
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
  const sortedObj = sortedKeys.reduce(
    (acc, key) => {
      acc[key] = obj[key];
      return acc;
    },
    {} as Record<string, any>,
  );
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
 * @example
 * Reactive params: pass a getter/computed and refetch when it changes.
 * ```vue
 * <script setup>
 * const version = ref('draft')
 * const { story, refresh } = await useAsyncStoryblok('home', {
 *   api: () => ({ version: version.value }),
 *   // re-fetch automatically when `version` changes
 *   watch: [version],
 * })
 * // ...or trigger manually: version.value = 'published'; await refresh()
 * </script>
 * ```
 */
export async function useAsyncStoryblok<T = any>(
  url: string,
  options: UseAsyncStoryblokOptions<T>,
): Promise<UseAsyncStoryblokResult<T>> {
  const storyblokApiInstance = useStoryblokApi();
  const { api, bridge, ...rest } = options;
  const uniqueKey = (): string => `${stableStringify(toValue(api))}${url}`;
  const bridgeEnabled = bridge !== false;
  const { storyblok } = useRuntimeConfig().public;
  if (!storyblok?.accessToken) {
    throw new Error(
      "Storyblok access token is not available to useAsyncStoryblok. Set storyblok.accessToken in your nuxt.config.ts, and make sure storyblok.enableServerClient is not enabled (it keeps the token server-only, so this client composable can't use it — use the server-side client from '#storyblok/server' instead in that mode).",
    );
  }

  // Copy resolve_relations and resolve_links from API options to bridge options
  // This ensures the bridge resolves the same relations during live preview updates
  const bridgeOptions: StoryblokBridgeConfigV2 = {
    ...bridge,
    resolveRelations:
      (bridge ? bridge.resolveRelations : undefined) ?? toValue(api).resolve_relations,
    resolveLinks: (bridge ? bridge.resolveLinks : undefined) ?? toValue(api).resolve_links,
  };

  const result = (await useAsyncData(
    uniqueKey,
    () => storyblokApiInstance.get(`cdn/stories/${url}`, { ...toValue(api) }),
    rest,
  )) as AsyncData<ISbStory<T>, NuxtError<unknown>>;

  // Register bridge for live preview updates (client-side only)
  // Use watch instead of onMounted because lifecycle hooks must be registered before the first await
  // in async setup functions, but we can't as we need the story.id
  if (import.meta.client && bridgeEnabled) {
    let registeredId: number | undefined;

    watch(
      () => result.data.value?.data?.story?.id,
      (storyId) => {
        if (!storyId || storyId === registeredId) {
          return;
        }
        registeredId = storyId;
        useStoryblokBridge(
          storyId,
          (evStory) => {
            // In Nuxt 4, data is a shallowRef - we must replace the entire object
            // to trigger reactivity instead of mutating nested properties
            if (!result.data.value) {
              return;
            }
            result.data.value = {
              ...result.data.value,
              data: { ...result.data.value.data, story: evStory },
            };
          },
          bridgeOptions,
        );
      },
      { immediate: true },
    );
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
