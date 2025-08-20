import type { SpaceOptions } from '../../constants';
import type { StoriesFilterOptions, StoriesQueryParams, Story } from './constants';
import { handleAPIError } from '../../utils/error';
import { objectToStringParams } from '../../utils';
import { mapiClient } from '../../api';

/**
 * Fetches stories from Storyblok Management API with optional query parameters
 * @param space - The space ID
 * @param params - Optional query parameters for filtering stories
 * @returns Promise with an array of stories or undefined if error occurs
 */
export const fetchStories = async (
  space: string,
  params?: StoriesQueryParams,
) => {
  try {
    const client = mapiClient();
    const allStories: Story[] = [];
    let currentPage = 1;
    let hasMorePages = true;
    const perPage = 100;

    while (hasMorePages) {
      // Extract filter_query params to handle them separately
      const { filter_query, ...restParams } = params || {};

      // Handle regular params with URLSearchParams
      const regularParams = new URLSearchParams({
        ...objectToStringParams({ ...restParams, per_page: perPage }),
        ...(currentPage > 1 && { page: currentPage.toString() }),
      }).toString();

      // Combine regular params with filter_query params (if any)
      const queryString = filter_query
        ? `${regularParams ? `${regularParams}&` : ''}${filter_query}`
        : regularParams;

      const endpoint = `spaces/${space}/stories${queryString ? `?${queryString}` : ''}`;

      const { data } = await client.get<{
        stories: Story[];
        per_page?: number;
        total?: number;
      }>(endpoint, {
      });

      allStories.push(...data.stories);

      // Since per_page and total may not be available, check if we got fewer stories than requested
      // If we got fewer stories than per_page, we've reached the end
      hasMorePages = data.stories.length === perPage && data.stories.length > 0;
      if (data.stories.length < perPage) {
        break;
      }
      currentPage++;
    }

    return allStories;
  }
  catch (error) {
    handleAPIError('pull_stories', error as Error);
  }
};

export async function fetchStoriesByComponent(
  spaceOptions: SpaceOptions,
  filterOptions?: StoriesFilterOptions,
): Promise<Story[] | undefined> {
  const { spaceId } = spaceOptions;
  const { componentName = '', query, starts_with } = filterOptions || {};

  // Convert filterOptions to StoriesQueryParams
  const params: StoriesQueryParams = {
    ...(starts_with && { starts_with }),
  };

  // Handle component filter
  if (componentName) {
    params.contain_component = componentName;
  }

  // Handle query string if provided
  if (query) {
    // Add filter_query prefix to the query parameter if it doesn't have it already
    params.filter_query = query.startsWith('filter_query') ? query : `filter_query${query}`;
  }

  try {
    const stories = await fetchStories(spaceId, params);
    return stories ?? [];
  }
  catch (error) {
    handleAPIError('pull_stories', error as Error);
  }
}

export const fetchStory = async (
  space: string,
  storyId: string,
) => {
  try {
    const client = mapiClient();
    const endpoint = `spaces/${space}/stories/${storyId}`;

    const { data } = await client.get<{
      story: Story;
    }>(endpoint, {
    });
    return data.story;
  }
  catch (error) {
    handleAPIError('pull_story', error as Error);
  }
};

/**
 * Updates a story in Storyblok with new content
 * @param space - The space ID
 * @param storyId - The ID of the story to update
 * @param payload - The payload containing story data and update options
 * @param payload.story - The story data to update
 * @param payload.force_update - Whether to force the update (optional)
 * @param payload.publish - Whether to publish the story (optional)
 * @returns Promise with the updated story or undefined if error occurs
 */
export const updateStory = async (
  space: string,
  storyId: number,
  payload: {
    story: Partial<Story>;
    force_update?: string;
    publish?: number;
  },
): Promise<Story | undefined> => {
  try {
    const client = mapiClient();
    const endpoint = `spaces/${space}/stories/${storyId}`;

    const { data } = await client.put<{
      story: Story;
    }>(endpoint, {
      body: JSON.stringify(payload),
    });

    return data.story;
  }
  catch (error) {
    handleAPIError('update_story', error as Error);
  }
};
