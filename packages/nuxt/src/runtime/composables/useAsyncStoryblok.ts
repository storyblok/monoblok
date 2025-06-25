import { useStoryblokApi, useStoryblokBridge } from '@storyblok/vue';
import type { ISbStoriesParams, ISbStoryData, StoryblokBridgeConfigV2 } from '@storyblok/vue';
import { onMounted, reactive, useAsyncData, useState } from '#imports';

interface StoryblokAsyncResult<T = ISbStoryData> {
  value: T;
  status?: number;
  response?: string;
}

export const useAsyncStoryblok = async (
  url: string,
  apiOptions: ISbStoriesParams = {},
  bridgeOptions: StoryblokBridgeConfigV2 = {},
): Promise<StoryblokAsyncResult> => {
  const storyblokApiInstance = useStoryblokApi();
  const uniqueKey = `${JSON.stringify(apiOptions)}${url}`;
  const story = useState<ISbStoryData>(`${uniqueKey}-state`);
  const error = useState<{ status?: number; response?: string } | null>(`${uniqueKey}-error`);

  onMounted(() => {
    if (story.value && story.value.id) {
      useStoryblokBridge(
        story.value.id,
        evStory => (story.value = evStory),
        bridgeOptions,
      );
    }
  });

  if (!story.value) {
    try {
      const { data } = await useAsyncData(uniqueKey, () => {
        return storyblokApiInstance.get(
          `cdn/stories/${url}`,
          apiOptions,
        );
      });
      if (data) {
        story.value = data.value?.data.story;
        error.value = null; // Reset error on successful fetch
      }
    }
    catch (err: unknown) {
      // Handle API errors with status/response properties
      if (typeof err === 'object' && err !== null && 'status' in err && 'response' in err) {
        error.value = {
          status: (err as { status?: number; response?: { status?: number; statusText?: string } }).status || (err as { response?: { status?: number } }).response?.status,
          response: (err as { message?: string; response?: { statusText?: string } }).message || (err as { response?: { statusText?: string } }).response?.statusText,
        };
      } else {
        error.value = {
          status: undefined,
          response: 'An unknown error occurred',
        };
      }
    }
  }

  // Return reactive object with story data and error metadata
  return reactive({
    get value() {
      return story.value;
    },
    set value(newValue) {
      story.value = newValue;
    },
    get status() {
      return error.value?.status;
    },
    get response() {
      return error.value?.response;
    },
  });
};
