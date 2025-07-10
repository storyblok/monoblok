import { useStoryblokApi, useStoryblokBridge } from '@storyblok/vue';
import type { ISbStoriesParams, ISbStoryData, StoryblokBridgeConfigV2 } from '@storyblok/vue';
import { onMounted, useAsyncData, useState } from '#imports';
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
  const story = useState<ISbStoryData>(`${uniqueKey}-state`);

  onMounted(() => {
    if (story.value && story.value.id) {
      useStoryblokBridge(
        story.value.id,
        evStory => (story.value = evStory),
        bridge,
      );
    }
  });

  if (!story.value) {
    const { data } = await useAsyncData(uniqueKey, () => storyblokApiInstance.get(`cdn/stories/${url}`, api), rest);
    if (data) {
      story.value = data.value?.data.story;
    }
  }
  return story;
};
