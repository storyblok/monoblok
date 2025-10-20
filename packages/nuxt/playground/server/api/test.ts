import { serverStoryblokClient } from '#storyblok/server';

export default defineEventHandler(async (event) => {
  // Get the Storyblok client with the event context
  const storyblokApi = serverStoryblokClient(event);

  try {
    // Fetch a story from Storyblok
    const { data } = await storyblokApi.get('cdn/stories/vue', {
      version: 'draft',
    });

    return {
      success: true,
      story: data.story,
    };
  }
  catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});
