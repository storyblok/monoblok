import type { SpaceOptions } from '../../constants';
import type { FetchStoriesResult, StoriesFilterOptions, StoriesQueryParams, Story } from './constants';
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

/**
 * Fetches all stories from Storyblok Management API using pagination headers
 * @param spaceId - The space ID
 * @param params - Optional query parameters for filtering stories
 * @returns Promise with an array of all stories or undefined if error occurs
 */
export const fetchAllStories = async (
  spaceId: string,
  params?: StoriesQueryParams,
) => {
  try {
    const allStories: Story[] = [];
    let currentPage = 1;
    let hasMorePages = true;
    const perPage = 100;

    while (hasMorePages) {
      const result = await fetchStories(spaceId, {
        ...params,
        per_page: perPage,
        page: currentPage,
      });

      if (!result) {
        break;
      }

      const { stories, headers } = result;

      if (stories && stories.length > 0) {
        allStories.push(...stories);

        // Check pagination headers
        const total = headers.get('Total');
        const perPageHeader = headers.get('Per-Page');

        if (total && perPageHeader) {
          const totalCount = Number(total);
          const perPageCount = Number(perPageHeader);
          const totalPages = Math.ceil(totalCount / perPageCount);

          hasMorePages = currentPage < totalPages;
        }
        else {
          // Fallback to current logic if headers are not available
          hasMorePages = stories.length === perPage;
        }
      }
      else {
        hasMorePages = false;
      }

      currentPage++;
    }

    return allStories;
  }
  catch (error) {
    handleAPIError('pull_stories', error as Error);
  }
};

export async function fetchAllStoriesByComponent(
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
    const stories = await fetchAllStories(spaceId, params);
    return stories ?? [];
  }
  catch (error) {
    handleAPIError('pull_stories', error as Error);
  }
}

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
