import type { FetchStoriesResult, StoriesQueryParams, Story } from './constants';
import { handleAPIError } from '../../utils/error';
import { mapiClient } from '../../api';

/**
 * Fetches a single page of stories from Storyblok Management API
 * @param spaceId - The space ID
 * @param params - Optional query parameters for filtering stories
 * @returns Promise with an array of stories and response headers or undefined if error occurs
 */
export const fetchStories = async (
  spaceId: string,
  params?: StoriesQueryParams,
): Promise<FetchStoriesResult | undefined> => {
  try {
    const client = mapiClient();
    const { data, response } = await client.stories.list({
      path: {
        space_id: spaceId,
      },
      query: {
        ...params,
        per_page: params?.per_page || 100,
        page: params?.page || 1,
      },
      throwOnError: true,
    });

    return {
      stories: data?.stories || [],
      headers: response.headers,
    };
  }
  catch (error) {
    handleAPIError('pull_stories', error as Error);
  }
};

export const fetchStory = async (
  spaceId: string,
  storyId: string,
) => {
  try {
    const client = mapiClient();

    const { data } = await client.stories.get({
      path: {
        space_id: spaceId,
        story_id: storyId,
      },
      throwOnError: true,
    });

    return data?.story;
  }
  catch (error) {
    handleAPIError('pull_story', error as Error);
  }
};

/**
 * Updates a story in Storyblok with new content
 * @param spaceId - The space ID
 * @param storyId - The ID of the story to update
 * @param payload - The payload containing story data and update options
 * @param payload.story - The story data to update
 * @param payload.force_update - Whether to force the update (optional)
 * @param payload.publish - Whether to publish the story (optional)
 * @returns Promise with the updated story or undefined if error occurs
 */
export const updateStory = async (
  spaceId: string,
  storyId: number,
  payload: {
    story: Story;
    force_update?: string;
    publish?: number;
  },
): Promise<Story | undefined> => {
  try {
    const client = mapiClient();

    const { data } = await client.stories.updateStory({
      path: {
        space_id: spaceId,
        story_id: storyId,
      },
      body: {
        story: payload.story as Story,
        force_update: payload.force_update === '1' ? '1' : '0',
        publish: payload.publish,
      },
      throwOnError: true,
    });

    return data?.story;
  }
  catch (error) {
    handleAPIError('update_story', error as Error);
  }
};
