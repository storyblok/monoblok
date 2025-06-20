import { customFetch } from '../../utils/fetch';
import { getStoryblokUrl } from '../../utils/api-routes';
import type { RegionCode, SpaceOptions } from '../../constants';
import type { StoriesFilterOptions, StoriesQueryParams, Story } from './constants';
import { handleAPIError } from '../../utils/error';
import { objectToStringParams } from '../../utils';

/**
 * Fetches stories from Storyblok Management API with optional query parameters
 * @param space - The space ID
 * @param token - The authentication token
 * @param region - The region code
 * @param params - Optional query parameters for filtering stories
 * @returns Promise with an array of stories or undefined if error occurs
 */
export const fetchStories = async (
  space: string,
  token: string,
  region: RegionCode,
  params?: StoriesQueryParams,
) => {
  try {
    const url = getStoryblokUrl(region);
    const allStories: Story[] = [];
    let currentPage = 1;
    let hasMorePages = true;

    while (hasMorePages) {
      // Extract filter_query params to handle them separately
      const { filter_query, ...restParams } = params || {};

      // Handle regular params with URLSearchParams
      const regularParams = new URLSearchParams({
        ...objectToStringParams({ ...restParams, per_page: 100 }),
        ...(currentPage > 1 && { page: currentPage.toString() }),
      }).toString();

      // Combine regular params with filter_query params (if any)
      const queryString = filter_query
        ? `${regularParams ? `${regularParams}&` : ''}${filter_query}`
        : regularParams;

      const endpoint = `${url}/spaces/${space}/stories${queryString ? `?${queryString}` : ''}`;

      const response = await customFetch<{
        stories: Story[];
        per_page: number;
        total: number;
      }>(endpoint, {
        headers: {
          Authorization: token,
        },
      });

      allStories.push(...response.stories);

      // Check if we have more pages to fetch
      const totalPages = Math.ceil(response.total / response.perPage);
      hasMorePages = currentPage < totalPages;
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
  const { spaceId, token, region } = spaceOptions;
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
    const stories = await fetchStories(spaceId, token, region, params);
    return stories ?? [];
  }
  catch (error) {
    handleAPIError('pull_stories', error as Error);
  }
}

export const fetchStory = async (
  space: string,
  token: string,
  region: RegionCode,
  storyId: string,
) => {
  try {
    const url = getStoryblokUrl(region);
    const endpoint = `${url}/spaces/${space}/stories/${storyId}`;

    const response = await customFetch<{
      story: Story;
    }>(endpoint, {
      headers: {
        Authorization: token,
      },
    });
    return response.story;
  }
  catch (error) {
    handleAPIError('pull_story', error as Error);
  }
};

/**
 * Updates a story in Storyblok with new content
 * @param space - The space ID
 * @param token - The authentication token
 * @param region - The region code
 * @param storyId - The ID of the story to update
 * @param payload - The payload containing story data and update options
 * @param payload.story - The story data to update
 * @param payload.force_update - Whether to force the update (optional)
 * @param payload.publish - Whether to publish the story (optional)
 * @returns Promise with the updated story or undefined if error occurs
 */
export const updateStory = async (
  space: string,
  token: string,
  region: RegionCode,
  storyId: number,
  payload: {
    story: Partial<Story>;
    force_update?: string;
    publish?: number;
  },
): Promise<Story | undefined> => {
  try {
    const url = getStoryblokUrl(region);
    const endpoint = `${url}/spaces/${space}/stories/${storyId}`;

    const response = await customFetch<{
      story: Story;
    }>(endpoint, {
      method: 'PUT',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    return response.story;
  }
  catch (error) {
    handleAPIError('update_story', error as Error);
  }
};
