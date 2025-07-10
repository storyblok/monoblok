import { useStoryblokApi, useStoryblokBridge } from '@storyblok/vue';
import type { ISbResult, ISbStoriesParams, StoryblokBridgeConfigV2 } from '@storyblok/vue';
import { computed, useAsyncData, watch } from '#imports';
import type { AsyncDataOptions } from 'nuxt/app';

export interface UseAsyncStoryblokOptions extends AsyncDataOptions<ISbResult> {
  api: ISbStoriesParams;
  bridge: StoryblokBridgeConfigV2;
}

export const useAsyncStoryblok = async (
  url: string,
  options: UseAsyncStoryblokOptions,
) => {
  const storyblokApiInstance = useStoryblokApi();
  const { api, bridge, ...rest } = options;
  const uniqueKey = `${JSON.stringify(api)}${url}`;

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
  };
};
